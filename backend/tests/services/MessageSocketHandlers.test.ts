import { Server } from 'socket.io';
import { SocketEventHandlers } from '../../src/services/SocketEventHandlers';
import { ConnectionManager } from '../../src/services/ConnectionManager';
import { MessageService } from '../../src/services/MessageService';
import { DatabaseService } from '../../src/database/DatabaseService';
import { AuthenticatedSocket } from '../../src/middleware/socketAuthMiddleware';
import { Message } from '../../src/models/Message';

// Mock dependencies
jest.mock('socket.io');
jest.mock('../../src/services/ConnectionManager');
jest.mock('../../src/services/MessageService');
jest.mock('../../src/database/DatabaseService');

describe('Message Socket Handlers', () => {
  let socketEventHandlers: SocketEventHandlers;
  let mockIo: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<AuthenticatedSocket>;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let mockDbService: any;
  let mockDb: any;
  let mockMessageService: jest.Mocked<MessageService>;

  beforeEach(() => {
    // Setup mock Socket.io server
    mockIo = new Server() as jest.Mocked<Server>;
    
    // Setup mock socket
    mockSocket = {
      id: 'socket-123',
      user: {
        id: 'user-1',
        screenName: 'testuser'
      },
      emit: jest.fn()
    } as unknown as jest.Mocked<AuthenticatedSocket>;
    
    // Setup mock ConnectionManager
    mockConnectionManager = {
      getInstance: jest.fn().mockReturnThis(),
      isUserOnline: jest.fn().mockReturnValue(true),
      emitToUser: jest.fn().mockReturnValue(true)
    } as unknown as jest.Mocked<ConnectionManager>;
    (ConnectionManager.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockConnectionManager);
    
    // Setup mock database
    mockDb = {};
    mockDbService = {
      getInstance: jest.fn().mockReturnThis(),
      getDb: jest.fn().mockResolvedValue(mockDb)
    };
    (DatabaseService.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockDbService);
    
    // Setup mock MessageService
    mockMessageService = {
      sendMessage: jest.fn(),
      markConversationAsRead: jest.fn()
    } as unknown as jest.Mocked<MessageService>;
    (MessageService as jest.Mock) = jest.fn().mockImplementation(() => mockMessageService);
    
    // Create SocketEventHandlers instance
    socketEventHandlers = new SocketEventHandlers(mockIo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSendMessage', () => {
    it('should send a message successfully', async () => {
      // Arrange
      const messageData = {
        toUserId: 'user-2',
        content: 'Hello there!'
      };
      
      const mockMessage: Message = {
        id: 'msg-123',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        content: 'Hello there!',
        timestamp: new Date(),
        isRead: false
      };
      
      mockMessageService.sendMessage.mockResolvedValue(mockMessage);
      mockConnectionManager.isUserOnline.mockReturnValue(true);
      
      // Act
      await socketEventHandlers.handleSendMessage(mockSocket, messageData);
      
      // Assert
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith({
        fromUserId: 'user-1',
        toUserId: 'user-2',
        content: 'Hello there!'
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('message:sent', { message: mockMessage });
      
      expect(mockConnectionManager.isUserOnline).toHaveBeenCalledWith('user-2');
      expect(mockConnectionManager.emitToUser).toHaveBeenCalledWith('user-2', 'message:receive', {
        message: mockMessage,
        from: {
          id: 'user-1',
          screenName: 'testuser'
        }
      });
    });

    it('should handle empty message content', async () => {
      // Arrange
      const messageData = {
        toUserId: 'user-2',
        content: ''
      };
      
      // Act
      await socketEventHandlers.handleSendMessage(mockSocket, messageData);
      
      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'INVALID_MESSAGE',
        message: 'Invalid message data'
      });
      expect(mockMessageService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle recipient being offline', async () => {
      // Arrange
      const messageData = {
        toUserId: 'user-2',
        content: 'Hello there!'
      };
      
      const mockMessage: Message = {
        id: 'msg-123',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        content: 'Hello there!',
        timestamp: new Date(),
        isRead: false
      };
      
      mockMessageService.sendMessage.mockResolvedValue(mockMessage);
      mockConnectionManager.isUserOnline.mockReturnValue(false);
      
      // Act
      await socketEventHandlers.handleSendMessage(mockSocket, messageData);
      
      // Assert
      expect(mockMessageService.sendMessage).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('message:sent', { message: mockMessage });
      expect(mockConnectionManager.emitToUser).not.toHaveBeenCalled();
    });
  });

  describe('handleMarkMessageRead', () => {
    it('should mark messages as read', async () => {
      // Arrange
      const data = {
        fromUserId: 'user-2'
      };
      
      // Act
      await socketEventHandlers.handleMarkMessageRead(mockSocket, data);
      
      // Assert
      expect(mockMessageService.markConversationAsRead).toHaveBeenCalledWith('user-1', 'user-2');
      expect(mockConnectionManager.isUserOnline).toHaveBeenCalledWith('user-2');
      expect(mockConnectionManager.emitToUser).toHaveBeenCalledWith('user-2', 'message:read', {
        byUserId: 'user-1',
        byScreenName: 'testuser'
      });
    });

    it('should handle invalid data', async () => {
      // Arrange
      const data = {
        fromUserId: ''
      };
      
      // Act
      await socketEventHandlers.handleMarkMessageRead(mockSocket, data);
      
      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'INVALID_REQUEST',
        message: 'Invalid request data'
      });
      expect(mockMessageService.markConversationAsRead).not.toHaveBeenCalled();
    });
  });

  describe('handleTypingIndicator', () => {
    it('should send typing indicator to recipient', () => {
      // Arrange
      const data = {
        toUserId: 'user-2',
        isTyping: true
      };
      
      mockConnectionManager.isUserOnline.mockReturnValue(true);
      
      // Act
      socketEventHandlers.handleTypingIndicator(mockSocket, data);
      
      // Assert
      expect(mockConnectionManager.isUserOnline).toHaveBeenCalledWith('user-2');
      expect(mockConnectionManager.emitToUser).toHaveBeenCalledWith('user-2', 'conversation:typing', {
        userId: 'user-1',
        screenName: 'testuser',
        isTyping: true
      });
    });

    it('should not send typing indicator if recipient is offline', () => {
      // Arrange
      const data = {
        toUserId: 'user-2',
        isTyping: true
      };
      
      mockConnectionManager.isUserOnline.mockReturnValue(false);
      
      // Act
      socketEventHandlers.handleTypingIndicator(mockSocket, data);
      
      // Assert
      expect(mockConnectionManager.isUserOnline).toHaveBeenCalledWith('user-2');
      expect(mockConnectionManager.emitToUser).not.toHaveBeenCalled();
    });
  });
});