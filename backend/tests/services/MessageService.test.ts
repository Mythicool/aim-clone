import { Database } from 'sqlite';
import { MessageService } from '../../src/services/MessageService';
import { MessageRepository } from '../../src/repositories/MessageRepository';
import { ConnectionManager } from '../../src/services/ConnectionManager';
import { CreateMessageData, Message } from '../../src/models/Message';

// Mock dependencies
jest.mock('../../src/repositories/MessageRepository');
jest.mock('../../src/services/ConnectionManager');

describe('MessageService', () => {
  let messageService: MessageService;
  let mockDb: Database;
  let mockMessageRepository: jest.Mocked<MessageRepository>;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;

  const mockMessage: Message = {
    id: 'msg-123',
    fromUserId: 'user-1',
    toUserId: 'user-2',
    content: 'Hello there!',
    timestamp: new Date(),
    isRead: false
  };

  beforeEach(() => {
    mockDb = {} as Database;
    
    // Setup MessageRepository mock
    mockMessageRepository = new MessageRepository(mockDb) as jest.Mocked<MessageRepository>;
    (MessageRepository as jest.Mock).mockImplementation(() => mockMessageRepository);
    
    // Setup ConnectionManager mock
    mockConnectionManager = {
      getInstance: jest.fn().mockReturnThis(),
      isUserOnline: jest.fn().mockReturnValue(true),
      emitToUser: jest.fn().mockReturnValue(true)
    } as unknown as jest.Mocked<ConnectionManager>;
    
    (ConnectionManager.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockConnectionManager);
    
    messageService = new MessageService(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should create a message successfully', async () => {
      // Arrange
      const messageData: CreateMessageData = {
        fromUserId: 'user-1',
        toUserId: 'user-2',
        content: 'Hello there!'
      };
      
      mockMessageRepository.create.mockResolvedValue(mockMessage);
      
      // Act
      const result = await messageService.sendMessage(messageData);
      
      // Assert
      expect(mockMessageRepository.create).toHaveBeenCalledWith(messageData);
      expect(result).toEqual(mockMessage);
    });

    it('should throw an error if message content is empty', async () => {
      // Arrange
      const messageData: CreateMessageData = {
        fromUserId: 'user-1',
        toUserId: 'user-2',
        content: ''
      };
      
      // Act & Assert
      await expect(messageService.sendMessage(messageData)).rejects.toThrow('Message content cannot be empty');
      expect(mockMessageRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getConversation', () => {
    it('should retrieve conversation messages', async () => {
      // Arrange
      const user1Id = 'user-1';
      const user2Id = 'user-2';
      const limit = 20;
      const offset = 0;
      const mockMessages = [mockMessage];
      
      mockMessageRepository.findConversation.mockResolvedValue(mockMessages);
      
      // Act
      const result = await messageService.getConversation(user1Id, user2Id, limit, offset);
      
      // Assert
      expect(mockMessageRepository.findConversation).toHaveBeenCalledWith(user1Id, user2Id, limit, offset);
      expect(result).toEqual(mockMessages);
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark all messages in a conversation as read', async () => {
      // Arrange
      const userId = 'user-1';
      const otherUserId = 'user-2';
      
      mockMessageRepository.markConversationAsRead.mockResolvedValue();
      
      // Act
      await messageService.markConversationAsRead(userId, otherUserId);
      
      // Assert
      expect(mockMessageRepository.markConversationAsRead).toHaveBeenCalledWith(userId, otherUserId);
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread message count for a user', async () => {
      // Arrange
      const userId = 'user-1';
      const expectedCount = 5;
      
      mockMessageRepository.getUnreadCount.mockResolvedValue(expectedCount);
      
      // Act
      const result = await messageService.getUnreadCount(userId);
      
      // Assert
      expect(mockMessageRepository.getUnreadCount).toHaveBeenCalledWith(userId);
      expect(result).toBe(expectedCount);
    });
  });

  describe('deleteConversation', () => {
    it('should delete a conversation between two users', async () => {
      // Arrange
      const user1Id = 'user-1';
      const user2Id = 'user-2';
      const deletedCount = 10;
      
      mockMessageRepository.deleteConversation.mockResolvedValue(deletedCount);
      
      // Act
      const result = await messageService.deleteConversation(user1Id, user2Id);
      
      // Assert
      expect(mockMessageRepository.deleteConversation).toHaveBeenCalledWith(user1Id, user2Id);
      expect(result).toBe(deletedCount);
    });
  });
});