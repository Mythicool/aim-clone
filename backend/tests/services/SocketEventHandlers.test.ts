import { Server } from 'socket.io';
import { createServer } from 'http';
import { SocketEventHandlers } from '../../src/services/SocketEventHandlers';
import { ConnectionManager } from '../../src/services/ConnectionManager';
import { AuthenticatedSocket } from '../../src/middleware/socketAuthMiddleware';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { UserStatus } from '../../src/models/User';

// Mock dependencies
jest.mock('../../src/services/ConnectionManager');
jest.mock('../../src/database/DatabaseService');
jest.mock('../../src/repositories/UserRepository');

describe('SocketEventHandlers', () => {
  let io: Server;
  let eventHandlers: SocketEventHandlers;
  let mockSocket: Partial<AuthenticatedSocket>;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let mockDbService: jest.Mocked<DatabaseService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    // Create HTTP server and Socket.io instance
    const httpServer = createServer();
    io = new Server(httpServer);

    // Mock socket
    mockSocket = {
      id: 'socket-123',
      user: {
        id: 'user-123',
        screenName: 'TestUser',
        email: 'test@example.com'
      },
      emit: jest.fn(),
      broadcast: {
        emit: jest.fn()
      } as any,
      on: jest.fn()
    } as any;

    // Mock connection manager
    mockConnectionManager = {
      addConnection: jest.fn(),
      removeConnection: jest.fn(),
      isUserOnline: jest.fn(),
      getOnlineUsers: jest.fn(),
      updateActivity: jest.fn(),
      emitToUser: jest.fn()
    } as any;

    (ConnectionManager.getInstance as jest.Mock).mockReturnValue(mockConnectionManager);

    // Mock database service
    mockDbService = {
      getInstance: jest.fn(),
      getDb: jest.fn()
    } as any;

    mockUserRepository = {
      update: jest.fn()
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDbService);
    (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);

    eventHandlers = new SocketEventHandlers(io);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setupEventHandlers', () => {
    it('should register all event handlers', () => {
      // Act
      eventHandlers.setupEventHandlers(mockSocket as AuthenticatedSocket);

      // Assert
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('user:status-change', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('heartbeat', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('handleConnection', () => {
    it('should handle new connection successfully', async () => {
      // Arrange
      mockConnectionManager.addConnection.mockResolvedValue();
      mockConnectionManager.getOnlineUsers.mockReturnValue(['user-456', 'user-789']);

      // Act
      await (eventHandlers as any).handleConnection(mockSocket);

      // Assert
      expect(mockConnectionManager.addConnection).toHaveBeenCalledWith(mockSocket);
      expect(mockSocket.emit).toHaveBeenCalledWith('connection:established', {
        userId: 'user-123',
        onlineUsers: ['user-456', 'user-789']
      });
      expect(mockSocket.broadcast!.emit).toHaveBeenCalledWith('buddy:online', {
        userId: 'user-123',
        screenName: 'TestUser',
        status: UserStatus.ONLINE
      });
    });

    it('should handle connection errors gracefully', async () => {
      // Arrange
      mockConnectionManager.addConnection.mockRejectedValue(new Error('Connection failed'));

      // Act
      await (eventHandlers as any).handleConnection(mockSocket);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'CONNECTION_ERROR',
        message: 'Failed to establish connection'
      });
    });
  });

  describe('handleDisconnect', () => {
    it('should handle disconnect when user goes offline', async () => {
      // Arrange
      mockConnectionManager.isUserOnline
        .mockReturnValueOnce(true)  // was online before disconnect
        .mockReturnValueOnce(false); // is offline after disconnect
      mockConnectionManager.removeConnection.mockResolvedValue();

      // Act
      await (eventHandlers as any).handleDisconnect(mockSocket);

      // Assert
      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith('socket-123');
      expect(mockSocket.broadcast!.emit).toHaveBeenCalledWith('buddy:offline', {
        userId: 'user-123',
        screenName: 'TestUser'
      });
    });

    it('should not broadcast offline when user has other connections', async () => {
      // Arrange
      mockConnectionManager.isUserOnline
        .mockReturnValueOnce(true)  // was online before disconnect
        .mockReturnValueOnce(true); // still online after disconnect
      mockConnectionManager.removeConnection.mockResolvedValue();

      // Act
      await (eventHandlers as any).handleDisconnect(mockSocket);

      // Assert
      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith('socket-123');
      expect(mockSocket.broadcast!.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleStatusChange', () => {
    it('should handle valid status change', async () => {
      // Arrange
      const statusData = { status: UserStatus.AWAY, awayMessage: 'Gone for lunch' };
      mockDbService.getDb.mockResolvedValue({} as any);
      mockUserRepository.update.mockResolvedValue({} as any);

      // Act
      await (eventHandlers as any).handleStatusChange(mockSocket, statusData);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        status: UserStatus.AWAY,
        awayMessage: 'Gone for lunch'
      });
      expect(mockSocket.broadcast!.emit).toHaveBeenCalledWith('buddy:status-change', {
        userId: 'user-123',
        screenName: 'TestUser',
        status: UserStatus.AWAY,
        awayMessage: 'Gone for lunch'
      });
    });

    it('should reject invalid status', async () => {
      // Arrange
      const statusData = { status: 'invalid-status' as UserStatus };

      // Act
      await (eventHandlers as any).handleStatusChange(mockSocket, statusData);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'INVALID_STATUS',
        message: 'Invalid status value'
      });
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should handle database errors during status change', async () => {
      // Arrange
      const statusData = { status: UserStatus.AWAY };
      mockDbService.getDb.mockRejectedValue(new Error('Database error'));

      // Act
      await (eventHandlers as any).handleStatusChange(mockSocket, statusData);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'STATUS_CHANGE_ERROR',
        message: 'Failed to update status'
      });
    });
  });

  describe('handleHeartbeat', () => {
    it('should update activity and respond to heartbeat', () => {
      // Act
      (eventHandlers as any).handleHeartbeat(mockSocket);

      // Assert
      expect(mockConnectionManager.updateActivity).toHaveBeenCalledWith('socket-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('heartbeat');
    });
  });

  describe('sendToUser', () => {
    it('should delegate to connection manager', () => {
      // Arrange
      mockConnectionManager.emitToUser.mockReturnValue(true);

      // Act
      const result = eventHandlers.sendToUser('user-456', 'test:event', { data: 'test' });

      // Assert
      expect(mockConnectionManager.emitToUser).toHaveBeenCalledWith('user-456', 'test:event', { data: 'test' });
      expect(result).toBe(true);
    });
  });
});