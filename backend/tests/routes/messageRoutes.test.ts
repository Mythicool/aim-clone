import request from 'supertest';
import express from 'express';
import { app } from '../../src/index';
import { MessageService } from '../../src/services/MessageService';
import { DatabaseService } from '../../src/database/DatabaseService';
import { authMiddleware } from '../../src/middleware/authMiddleware';

// Mock dependencies
jest.mock('../../src/services/MessageService');
jest.mock('../../src/database/DatabaseService');
jest.mock('../../src/middleware/authMiddleware');

describe('Message Routes', () => {
  let mockMessageService: jest.Mocked<MessageService>;
  let mockDb: any;
  let mockDbService: any;

  beforeEach(() => {
    // Setup mock database
    mockDb = {};
    mockDbService = {
      getDb: jest.fn().mockResolvedValue(mockDb)
    };
    (DatabaseService.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockDbService);
    
    // Setup mock MessageService
    mockMessageService = new MessageService(mockDb) as jest.Mocked<MessageService>;
    (MessageService as jest.Mock) = jest.fn().mockImplementation(() => mockMessageService);
    
    // Setup mock auth middleware
    (authMiddleware as jest.Mock) = jest.fn((req, res, next) => {
      req.user = { id: 'test-user-id', screenName: 'testuser' };
      next();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/messages/conversation/:userId', () => {
    it('should return conversation messages', async () => {
      // Arrange
      const mockMessages = [
        {
          id: 'msg-1',
          fromUserId: 'test-user-id',
          toUserId: 'other-user-id',
          content: 'Hello',
          timestamp: new Date(),
          isRead: false
        }
      ];
      
      mockMessageService.getConversation.mockResolvedValue(mockMessages);
      
      // Act & Assert
      const response = await request(app)
        .get('/api/messages/conversation/other-user-id')
        .expect(200);
      
      expect(response.body).toEqual({ messages: mockMessages });
      expect(mockMessageService.getConversation).toHaveBeenCalledWith(
        'test-user-id', 'other-user-id', 50, 0
      );
    });

    it('should handle errors', async () => {
      // Arrange
      mockMessageService.getConversation.mockRejectedValue(new Error('Database error'));
      
      // Act & Assert
      const response = await request(app)
        .get('/api/messages/conversation/other-user-id')
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to fetch conversation');
    });
  });

  describe('POST /api/messages/send', () => {
    it('should send a message', async () => {
      // Arrange
      const mockMessage = {
        id: 'msg-1',
        fromUserId: 'test-user-id',
        toUserId: 'other-user-id',
        content: 'Hello',
        timestamp: new Date(),
        isRead: false
      };
      
      mockMessageService.sendMessage.mockResolvedValue(mockMessage);
      
      // Act & Assert
      const response = await request(app)
        .post('/api/messages/send')
        .send({
          toUserId: 'other-user-id',
          content: 'Hello'
        })
        .expect(201);
      
      expect(response.body).toEqual({ message: mockMessage });
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith({
        fromUserId: 'test-user-id',
        toUserId: 'other-user-id',
        content: 'Hello'
      });
    });

    it('should return 400 if required fields are missing', async () => {
      // Act & Assert
      const response = await request(app)
        .post('/api/messages/send')
        .send({
          // Missing toUserId
          content: 'Hello'
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Missing required fields');
      expect(mockMessageService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/messages/mark-read/:userId', () => {
    it('should mark conversation as read', async () => {
      // Arrange
      mockMessageService.markConversationAsRead.mockResolvedValue();
      
      // Act & Assert
      const response = await request(app)
        .post('/api/messages/mark-read/other-user-id')
        .expect(200);
      
      expect(response.body).toEqual({ success: true });
      expect(mockMessageService.markConversationAsRead).toHaveBeenCalledWith(
        'test-user-id', 'other-user-id'
      );
    });
  });

  describe('GET /api/messages/unread-count', () => {
    it('should return unread message count', async () => {
      // Arrange
      mockMessageService.getUnreadCount.mockResolvedValue(5);
      
      // Act & Assert
      const response = await request(app)
        .get('/api/messages/unread-count')
        .expect(200);
      
      expect(response.body).toEqual({ count: 5 });
      expect(mockMessageService.getUnreadCount).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('DELETE /api/messages/conversation/:userId', () => {
    it('should delete a conversation', async () => {
      // Arrange
      mockMessageService.deleteConversation.mockResolvedValue(10);
      
      // Act & Assert
      const response = await request(app)
        .delete('/api/messages/conversation/other-user-id')
        .expect(200);
      
      expect(response.body).toEqual({ success: true, deletedCount: 10 });
      expect(mockMessageService.deleteConversation).toHaveBeenCalledWith(
        'test-user-id', 'other-user-id'
      );
    });
  });
});