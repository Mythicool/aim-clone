import request from 'supertest';
import { app, io, dbService } from '../../src/index';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { MessageRepository } from '../../src/repositories/MessageRepository';
import { AuthService } from '../../src/services/AuthService';
import { Server } from 'socket.io';
import { io as ioc, Socket } from 'socket.io-client';
import { createServer } from 'http';

describe('Messaging Integration Tests', () => {
  let server: any;
  let db: any;
  let userRepository: UserRepository;
  let messageRepository: MessageRepository;
  let authService: AuthService;
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let clientSocket1: Socket;
  let clientSocket2: Socket;

  beforeAll(async () => {
    // Start server
    server = createServer(app);
    server.listen();
    
    // Initialize database
    await dbService.initialize();
    db = await dbService.getDb();
    
    // Create repositories
    userRepository = new UserRepository(db);
    messageRepository = new MessageRepository(db);
    authService = new AuthService(db);
    
    // Create test users
    const user1 = await authService.register('testuser1', 'password123', 'test1@example.com');
    const user2 = await authService.register('testuser2', 'password123', 'test2@example.com');
    
    user1Id = user1.id;
    user2Id = user2.id;
    
    // Get auth tokens
    const auth1 = await authService.login('testuser1', 'password123');
    const auth2 = await authService.login('testuser2', 'password123');
    
    user1Token = auth1.token;
    user2Token = auth2.token;
  });

  afterAll(async () => {
    // Clean up test data
    await messageRepository.deleteConversation(user1Id, user2Id);
    await userRepository.delete(user1Id);
    await userRepository.delete(user2Id);
    
    // Close database and server
    await dbService.close();
    server.close();
    io.close();
  });

  describe('REST API Messaging', () => {
    it('should send a message via REST API', async () => {
      // Act
      const response = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          toUserId: user2Id,
          content: 'Hello from REST API'
        });
      
      // Assert
      expect(response.status).toBe(201);
      expect(response.body.message).toBeDefined();
      expect(response.body.message.fromUserId).toBe(user1Id);
      expect(response.body.message.toUserId).toBe(user2Id);
      expect(response.body.message.content).toBe('Hello from REST API');
    });

    it('should retrieve conversation history', async () => {
      // Act
      const response = await request(app)
        .get(`/api/messages/conversation/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.messages).toBeDefined();
      expect(response.body.messages.length).toBeGreaterThan(0);
      
      const lastMessage = response.body.messages[response.body.messages.length - 1];
      expect(lastMessage.content).toBe('Hello from REST API');
    });

    it('should mark messages as read', async () => {
      // Act
      const response = await request(app)
        .post(`/api/messages/mark-read/${user1Id}`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify messages are marked as read
      const unreadCount = await messageRepository.getUnreadCountFromUser(user2Id, user1Id);
      expect(unreadCount).toBe(0);
    });
  });

  // Note: WebSocket tests would be here, but they require more complex setup
  // with actual socket connections. In a real implementation, you might use
  // a library like socket.io-client for testing WebSocket functionality.
});