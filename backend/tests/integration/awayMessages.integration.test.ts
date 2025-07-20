import request from 'supertest';
import { Server } from 'http';
import { Socket, io as ioClient } from 'socket.io-client';
import { createApp } from '../../src/app';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { AuthService } from '../../src/services/AuthService';
import { UserStatus } from '../../src/models/User';

describe('Away Messages Integration Tests', () => {
  let server: Server;
  let app: Express.Application;
  let dbService: DatabaseService;
  let authService: AuthService;
  let userRepository: UserRepository;
  let testUserToken: string;
  let testUserId: string;
  let clientSocket: Socket;
  
  beforeAll(async () => {
    // Setup app and server
    app = await createApp();
    server = app.listen(0); // Use any available port
    
    // Get database service
    dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    
    // Create repositories and services
    userRepository = new UserRepository(db);
    authService = new AuthService(userRepository);
    
    // Create test user
    const testUser = await authService.register({
      screenName: 'awayuser',
      email: 'away@test.com',
      password: 'password123'
    });
    
    testUserId = testUser.id;
    
    // Login to get token
    const authResult = await authService.login('awayuser', 'password123');
    testUserToken = authResult.token;
    
    // Get server port
    const port = (server.address() as any).port;
    
    // Connect socket client
    clientSocket = ioClient(`http://localhost:${port}`, {
      auth: { token: testUserToken }
    });
    
    // Wait for connection
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    // Disconnect socket
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    
    // Close server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    
    // Clean up database
    if (testUserId) {
      await userRepository.delete(testUserId);
    }
  });
  
  describe('Away Message API Endpoints', () => {
    it('should update user status with away message', async () => {
      const response = await request(app)
        .put('/api/users/status')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          status: UserStatus.AWAY,
          awayMessage: 'Gone for lunch'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.user.status).toBe(UserStatus.AWAY);
      expect(response.body.user.awayMessage).toBe('Gone for lunch');
      
      // Verify in database
      const user = await userRepository.findById(testUserId);
      expect(user?.status).toBe(UserStatus.AWAY);
      expect(user?.awayMessage).toBe('Gone for lunch');
    });
    
    it('should clear away message when status changes from AWAY', async () => {
      // First set to away with message
      await request(app)
        .put('/api/users/status')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          status: UserStatus.AWAY,
          awayMessage: 'Gone for lunch'
        });
      
      // Then change to online
      const response = await request(app)
        .put('/api/users/status')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          status: UserStatus.ONLINE
        });
      
      expect(response.status).toBe(200);
      expect(response.body.user.status).toBe(UserStatus.ONLINE);
      expect(response.body.user.awayMessage).toBeNull();
      
      // Verify in database
      const user = await userRepository.findById(testUserId);
      expect(user?.status).toBe(UserStatus.ONLINE);
      expect(user?.awayMessage).toBeNull();
    });
    
    it('should reject away messages that exceed maximum length', async () => {
      const longMessage = 'A'.repeat(201); // 201 characters
      
      const response = await request(app)
        .put('/api/users/status')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          status: UserStatus.AWAY,
          awayMessage: longMessage
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
  
  describe('WebSocket Away Message Events', () => {
    it('should emit status change with away message', async () => {
      // Setup listener for status change events
      const statusChangePromise = new Promise<any>((resolve) => {
        clientSocket.once('buddy:status-change', (data) => {
          resolve(data);
        });
      });
      
      // Emit status change event
      clientSocket.emit('user:status-change', {
        status: UserStatus.AWAY,
        awayMessage: 'Be right back'
      });
      
      // Wait for status change event
      const statusChangeData = await statusChangePromise;
      
      // Verify event data
      expect(statusChangeData.status).toBe(UserStatus.AWAY);
      expect(statusChangeData.awayMessage).toBe('Be right back');
      
      // Verify in database
      const user = await userRepository.findById(testUserId);
      expect(user?.status).toBe(UserStatus.AWAY);
      expect(user?.awayMessage).toBe('Be right back');
    });
  });
});