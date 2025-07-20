import { Server } from 'socket.io';
import { createServer } from 'http';
import { ConnectionManager } from '../../src/services/ConnectionManager';
import { AuthenticatedSocket } from '../../src/middleware/socketAuthMiddleware';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { UserStatus } from '../../src/models/User';

// Mock dependencies
jest.mock('../../src/database/DatabaseService');
jest.mock('../../src/repositories/UserRepository');

describe('ConnectionManager', () => {
  let io: Server;
  let connectionManager: ConnectionManager;
  let mockSocket: Partial<AuthenticatedSocket>;
  let mockDbService: jest.Mocked<DatabaseService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    // Create HTTP server and Socket.io instance
    const httpServer = createServer();
    io = new Server(httpServer);

    // Reset singleton
    (ConnectionManager as any).instance = null;
    connectionManager = ConnectionManager.getInstance(io);

    // Mock socket
    mockSocket = {
      id: 'socket-123',
      user: {
        id: 'user-123',
        screenName: 'TestUser',
        email: 'test@example.com'
      }
    };

    // Mock database service
    mockDbService = {
      getDb: jest.fn(),
      getInstance: jest.fn()
    } as any;

    mockUserRepository = {
      updateStatus: jest.fn()
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDbService);
    mockDbService.getDb.mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addConnection', () => {
    it('should add a new connection successfully', async () => {
      // Arrange
      const mockDb = {} as any;
      mockDbService.getDb.mockResolvedValue(mockDb);
      (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

      // Act
      await connectionManager.addConnection(mockSocket as AuthenticatedSocket);

      // Assert
      expect(connectionManager.isUserOnline('user-123')).toBe(true);
      expect(mockUserRepository.updateStatus).toHaveBeenCalledWith('user-123', UserStatus.ONLINE);
    });

    it('should handle multiple connections for the same user', async () => {
      // Arrange
      const mockDb = {} as any;
      mockDbService.getDb.mockResolvedValue(mockDb);
      (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

      const secondSocket = {
        ...mockSocket,
        id: 'socket-456'
      };

      // Act
      await connectionManager.addConnection(mockSocket as AuthenticatedSocket);
      await connectionManager.addConnection(secondSocket as AuthenticatedSocket);

      // Assert
      expect(connectionManager.isUserOnline('user-123')).toBe(true);
      expect(mockUserRepository.updateStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeConnection', () => {
    it('should remove connection and set user offline when no more connections', async () => {
      // Arrange
      const mockDb = {} as any;
      mockDbService.getDb.mockResolvedValue(mockDb);
      (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

      await connectionManager.addConnection(mockSocket as AuthenticatedSocket);

      // Act
      await connectionManager.removeConnection('socket-123');

      // Assert
      expect(connectionManager.isUserOnline('user-123')).toBe(false);
      expect(mockUserRepository.updateStatus).toHaveBeenCalledWith('user-123', UserStatus.OFFLINE);
    });

    it('should keep user online when they have other connections', async () => {
      // Arrange
      const mockDb = {} as any;
      mockDbService.getDb.mockResolvedValue(mockDb);
      (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

      const secondSocket = {
        ...mockSocket,
        id: 'socket-456'
      };

      await connectionManager.addConnection(mockSocket as AuthenticatedSocket);
      await connectionManager.addConnection(secondSocket as AuthenticatedSocket);

      // Act
      await connectionManager.removeConnection('socket-123');

      // Assert
      expect(connectionManager.isUserOnline('user-123')).toBe(true);
      // Should only be called twice for the initial connections, not for offline
      expect(mockUserRepository.updateStatus).toHaveBeenCalledTimes(2);
    });

    it('should handle removing non-existent connection gracefully', async () => {
      // Act & Assert - should not throw
      await expect(connectionManager.removeConnection('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('updateActivity', () => {
    it('should update last activity for existing connection', async () => {
      // Arrange
      const mockDb = {} as any;
      mockDbService.getDb.mockResolvedValue(mockDb);
      (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

      await connectionManager.addConnection(mockSocket as AuthenticatedSocket);
      const beforeUpdate = new Date();

      // Act
      connectionManager.updateActivity('socket-123');

      // Assert
      const connection = connectionManager.getUserConnection('user-123');
      expect(connection).toBeTruthy();
      expect(connection!.lastActivity.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should handle updating activity for non-existent connection', () => {
      // Act & Assert - should not throw
      expect(() => connectionManager.updateActivity('non-existent')).not.toThrow();
    });
  });

  describe('isUserOnline', () => {
    it('should return true for online user', async () => {
      // Arrange
      const mockDb = {} as any;
      mockDbService.getDb.mockResolvedValue(mockDb);
      (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

      await connectionManager.addConnection(mockSocket as AuthenticatedSocket);

      // Act & Assert
      expect(connectionManager.isUserOnline('user-123')).toBe(true);
    });

    it('should return false for offline user', () => {
      // Act & Assert
      expect(connectionManager.isUserOnline('user-123')).toBe(false);
    });
  });

  describe('getUserConnection', () => {
    it('should return connection for online user', async () => {
      // Arrange
      const mockDb = {} as any;
      mockDbService.getDb.mockResolvedValue(mockDb);
      (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

      await connectionManager.addConnection(mockSocket as AuthenticatedSocket);

      // Act
      const connection = connectionManager.getUserConnection('user-123');

      // Assert
      expect(connection).toBeTruthy();
      expect(connection!.userId).toBe('user-123');
      expect(connection!.screenName).toBe('TestUser');
      expect(connection!.socketId).toBe('socket-123');
    });

    it('should return null for offline user', () => {
      // Act
      const connection = connectionManager.getUserConnection('user-123');

      // Assert
      expect(connection).toBeNull();
    });
  });

  describe('getOnlineUsers', () => {
    it('should return list of online user IDs', async () => {
      // Arrange
      const mockDb = {} as any;
      mockDbService.getDb.mockResolvedValue(mockDb);
      (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

      const secondSocket = {
        id: 'socket-456',
        user: {
          id: 'user-456',
          screenName: 'TestUser2',
          email: 'test2@example.com'
        }
      };

      await connectionManager.addConnection(mockSocket as AuthenticatedSocket);
      await connectionManager.addConnection(secondSocket as AuthenticatedSocket);

      // Act
      const onlineUsers = connectionManager.getOnlineUsers();

      // Assert
      expect(onlineUsers).toContain('user-123');
      expect(onlineUsers).toContain('user-456');
      expect(onlineUsers).toHaveLength(2);
    });

    it('should return empty array when no users online', () => {
      // Act
      const onlineUsers = connectionManager.getOnlineUsers();

      // Assert
      expect(onlineUsers).toEqual([]);
    });
  });
});