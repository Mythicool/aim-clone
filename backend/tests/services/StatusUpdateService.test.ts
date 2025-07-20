import { Server } from 'socket.io';
import { createServer } from 'http';
import { SocketEventHandlers } from '../../src/services/SocketEventHandlers';
import { ConnectionManager } from '../../src/services/ConnectionManager';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { BuddyRelationshipRepository } from '../../src/repositories/BuddyRelationshipRepository';
import { UserStatus } from '../../src/models/User';
import { AuthenticatedSocket } from '../../src/middleware/socketAuthMiddleware';

// Mock the database service
jest.mock('../../src/database/DatabaseService');
jest.mock('../../src/repositories/UserRepository');
jest.mock('../../src/repositories/BuddyRelationshipRepository');

describe('Status Update Service', () => {
  let io: Server;
  let socketEventHandlers: SocketEventHandlers;
  let connectionManager: ConnectionManager;
  let mockDb: any;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockBuddyRepository: jest.Mocked<BuddyRelationshipRepository>;

  const mockUser1 = {
    id: 'user1',
    screenName: 'TestUser1',
    email: 'test1@example.com',
    passwordHash: 'hash1',
    displayName: 'Test User 1',
    status: UserStatus.ONLINE,
    lastSeen: new Date(),
    createdAt: new Date()
  };

  const mockUser2 = {
    id: 'user2',
    screenName: 'TestUser2',
    email: 'test2@example.com',
    passwordHash: 'hash2',
    displayName: 'Test User 2',
    status: UserStatus.ONLINE,
    lastSeen: new Date(),
    createdAt: new Date()
  };

  beforeEach(() => {
    // Create HTTP server and Socket.io instance
    const httpServer = createServer();
    io = new Server(httpServer);

    // Setup mocks
    mockDb = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn()
    };

    mockUserRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn()
    } as any;

    mockBuddyRepository = {
      findUsersWithBuddy: jest.fn()
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue({
      getDb: jest.fn().mockResolvedValue(mockDb)
    });

    (UserRepository as jest.MockedClass<typeof UserRepository>).mockImplementation(() => mockUserRepository);
    (BuddyRelationshipRepository as jest.MockedClass<typeof BuddyRelationshipRepository>).mockImplementation(() => mockBuddyRepository);

    // Create instances
    connectionManager = ConnectionManager.getInstance(io);
    socketEventHandlers = new SocketEventHandlers(io);
  });

  afterEach(() => {
    socketEventHandlers.cleanup();
    jest.clearAllMocks();
  });

  describe('Buddy Status Broadcasting', () => {
    it('should notify only buddies when user comes online', async () => {
      // Setup: User2 has User1 as a buddy
      mockBuddyRepository.findUsersWithBuddy.mockResolvedValue([
        {
          id: 'rel1',
          userId: 'user2',
          buddyId: 'user1',
          groupName: 'Buddies',
          addedAt: new Date()
        }
      ]);

      // Mock socket for user2 (who should receive notification)
      const mockSocket2 = {
        id: 'socket2',
        user: mockUser2,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      // Add user2 connection
      await connectionManager.addConnection(mockSocket2);

      // Mock socket for user1 (who is coming online)
      const mockSocket1 = {
        id: 'socket1',
        user: mockUser1,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      // Setup event handlers for user1
      socketEventHandlers.setupEventHandlers(mockSocket1);

      // Simulate user1 connecting
      await connectionManager.addConnection(mockSocket1);

      // Verify that user2 was notified about user1 coming online
      expect(mockBuddyRepository.findUsersWithBuddy).toHaveBeenCalledWith('user1');
    });

    it('should notify only buddies when user goes offline', async () => {
      // Setup: User2 has User1 as a buddy
      mockBuddyRepository.findUsersWithBuddy.mockResolvedValue([
        {
          id: 'rel1',
          userId: 'user2',
          buddyId: 'user1',
          groupName: 'Buddies',
          addedAt: new Date()
        }
      ]);

      // Mock sockets
      const mockSocket1 = {
        id: 'socket1',
        user: mockUser1,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      const mockSocket2 = {
        id: 'socket2',
        user: mockUser2,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      // Add connections
      await connectionManager.addConnection(mockSocket1);
      await connectionManager.addConnection(mockSocket2);

      // Setup event handlers
      socketEventHandlers.setupEventHandlers(mockSocket1);

      // Simulate user1 disconnecting
      await connectionManager.removeConnection('socket1');

      // Verify that buddies were queried for notification
      expect(mockBuddyRepository.findUsersWithBuddy).toHaveBeenCalledWith('user1');
    });

    it('should notify only buddies when user changes status', async () => {
      // Setup: User2 has User1 as a buddy
      mockBuddyRepository.findUsersWithBuddy.mockResolvedValue([
        {
          id: 'rel1',
          userId: 'user2',
          buddyId: 'user1',
          groupName: 'Buddies',
          addedAt: new Date()
        }
      ]);

      mockUserRepository.update.mockResolvedValue(mockUser1);

      // Mock sockets
      const mockSocket1 = {
        id: 'socket1',
        user: mockUser1,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      const mockSocket2 = {
        id: 'socket2',
        user: mockUser2,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      // Add connections
      await connectionManager.addConnection(mockSocket1);
      await connectionManager.addConnection(mockSocket2);

      // Setup event handlers
      socketEventHandlers.setupEventHandlers(mockSocket1);

      // Simulate status change
      mockSocket1.emit('user:status-change', {
        status: UserStatus.AWAY,
        awayMessage: 'Gone for lunch'
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify database update
      expect(mockUserRepository.update).toHaveBeenCalledWith('user1', {
        status: UserStatus.AWAY,
        awayMessage: 'Gone for lunch'
      });

      // Verify buddies were queried for notification
      expect(mockBuddyRepository.findUsersWithBuddy).toHaveBeenCalledWith('user1');
    });
  });

  describe('Idle Detection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should automatically set idle users to away status', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser1);
      mockUserRepository.update.mockResolvedValue({
        ...mockUser1,
        status: UserStatus.AWAY,
        awayMessage: 'Automatically set to away due to inactivity'
      });

      mockBuddyRepository.findUsersWithBuddy.mockResolvedValue([]);

      // Mock socket
      const mockSocket = {
        id: 'socket1',
        user: mockUser1,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      // Add connection
      await connectionManager.addConnection(mockSocket);

      // Set last activity to 11 minutes ago (past idle threshold)
      const connection = connectionManager.getAllConnections()[0];
      connection.lastActivity = new Date(Date.now() - 11 * 60 * 1000);

      // Fast-forward time to trigger idle check
      jest.advanceTimersByTime(60 * 1000); // 1 minute

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify user was set to away
      expect(mockUserRepository.update).toHaveBeenCalledWith('user1', {
        status: UserStatus.AWAY,
        awayMessage: 'Automatically set to away due to inactivity'
      });
    });

    it('should not set already away users to away again', async () => {
      // Mock socket with away user
      const awayUser = { ...mockUser1, status: UserStatus.AWAY };
      const mockSocket = {
        id: 'socket1',
        user: awayUser,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      // Add connection
      await connectionManager.addConnection(mockSocket);

      // Manually set connection status to away
      const connection = connectionManager.getAllConnections()[0];
      connection.status = UserStatus.AWAY;
      connection.lastActivity = new Date(Date.now() - 11 * 60 * 1000);

      // Fast-forward time to trigger idle check
      jest.advanceTimersByTime(60 * 1000);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify user was not updated (since already away)
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Activity Tracking', () => {
    it('should update last activity on heartbeat', async () => {
      // Mock socket
      const mockSocket = {
        id: 'socket1',
        user: mockUser1,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() },
        on: jest.fn()
      } as any as AuthenticatedSocket;

      // Add connection
      await connectionManager.addConnection(mockSocket);

      const initialActivity = connectionManager.getAllConnections()[0].lastActivity;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update activity
      connectionManager.updateActivity('socket1');

      const updatedActivity = connectionManager.getAllConnections()[0].lastActivity;

      // Verify activity was updated
      expect(updatedActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });

    it('should update user status in connection manager', () => {
      // Mock socket
      const mockSocket = {
        id: 'socket1',
        user: mockUser1,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() }
      } as any as AuthenticatedSocket;

      // Add connection
      connectionManager.addConnection(mockSocket);

      // Update status
      connectionManager.updateUserStatus('user1', UserStatus.AWAY);

      // Verify status was updated
      const connection = connectionManager.getAllConnections()[0];
      expect(connection.status).toBe(UserStatus.AWAY);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid status changes gracefully', async () => {
      const mockSocket = {
        id: 'socket1',
        user: mockUser1,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() },
        on: jest.fn()
      } as any as AuthenticatedSocket;

      // Setup event handlers
      socketEventHandlers.setupEventHandlers(mockSocket);

      // Simulate invalid status change
      const eventHandlers = (socketEventHandlers as any);
      await eventHandlers.handleStatusChange(mockSocket, { status: 'invalid_status' });

      // Verify error was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'INVALID_STATUS',
        message: 'Invalid status value'
      });
    });

    it('should handle database errors during status updates', async () => {
      mockUserRepository.update.mockRejectedValue(new Error('Database error'));

      const mockSocket = {
        id: 'socket1',
        user: mockUser1,
        emit: jest.fn(),
        broadcast: { emit: jest.fn() },
        on: jest.fn()
      } as any as AuthenticatedSocket;

      // Setup event handlers
      socketEventHandlers.setupEventHandlers(mockSocket);

      // Trigger status change event manually
      const eventHandlers = (socketEventHandlers as any);
      await eventHandlers.handleStatusChange(mockSocket, {
        status: UserStatus.AWAY,
        awayMessage: 'Test away'
      });

      // Verify error was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'STATUS_CHANGE_ERROR',
        message: 'Failed to update status'
      });
    });
  });
});