import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { socketAuthMiddleware } from '../../src/middleware/socketAuthMiddleware';
import { ConnectionManager } from '../../src/services/ConnectionManager';
import { SocketEventHandlers } from '../../src/services/SocketEventHandlers';
import { UserStatus } from '../../src/models/User';

describe('WebSocket Integration Tests', () => {
  let httpServer: any;
  let io: Server;
  let clientSocket: ClientSocket;
  let connectionManager: ConnectionManager;
  let eventHandlers: SocketEventHandlers;
  let dbService: DatabaseService;
  let userRepository: UserRepository;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Initialize database
    dbService = DatabaseService.getInstance();
    await dbService.initialize();
    
    const db = await dbService.getDb();
    userRepository = new UserRepository(db);

    // Create test user
    testUser = await userRepository.create({
      screenName: 'TestUser',
      email: 'test@example.com',
      passwordHash: 'hashedpassword'
    });

    // Generate auth token
    const jwtSecret = process.env.JWT_SECRET || 'aim-secret-key-change-in-production';
    authToken = jwt.sign({ userId: testUser.id }, jwtSecret);
  });

  beforeEach((done) => {
    // Create HTTP server and Socket.io instance
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Setup WebSocket middleware and handlers
    io.use(socketAuthMiddleware);
    connectionManager = ConnectionManager.getInstance(io);
    eventHandlers = new SocketEventHandlers(io);

    io.on('connection', (socket) => {
      eventHandlers.setupEventHandlers(socket as any);
    });

    // Start server
    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      
      // Create client connection
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: authToken
        }
      });

      clientSocket.on('connect', done);
    });
  });

  afterEach((done) => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    
    io.close();
    httpServer.close(done);
    
    // Reset connection manager singleton
    (ConnectionManager as any).instance = null;
  });

  afterAll(async () => {
    await dbService.close();
  });

  it('should authenticate and establish connection successfully', (done) => {
    clientSocket.on('connection:established', (data: any) => {
      expect(data.userId).toBe(testUser.id);
      expect(Array.isArray(data.onlineUsers)).toBe(true);
      done();
    });
  });

  it('should handle status change events', (done) => {
    const newStatus = UserStatus.AWAY;
    const awayMessage = 'Gone for lunch';

    // Listen for status change confirmation
    clientSocket.on('buddy:status-change', (data: any) => {
      expect(data.userId).toBe(testUser.id);
      expect(data.screenName).toBe(testUser.screenName);
      expect(data.status).toBe(newStatus);
      expect(data.awayMessage).toBe(awayMessage);
      done();
    });

    // Send status change
    clientSocket.emit('user:status-change', {
      status: newStatus,
      awayMessage: awayMessage
    });
  });

  it('should handle heartbeat correctly', (done) => {
    clientSocket.on('heartbeat', () => {
      done();
    });

    clientSocket.emit('heartbeat');
  });

  it('should handle connection errors gracefully', (done) => {
    // Create client with invalid token
    const invalidClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
      auth: {
        token: 'invalid-token'
      }
    });

    invalidClient.on('connect_error', (error: any) => {
      expect(error.message).toContain('Authentication');
      invalidClient.disconnect();
      done();
    });
  });

  it('should track user online status correctly', (done) => {
    // Wait for connection to be established
    clientSocket.on('connection:established', () => {
      // Check if user is tracked as online
      expect(connectionManager.isUserOnline(testUser.id)).toBe(true);
      
      const connection = connectionManager.getUserConnection(testUser.id);
      expect(connection).toBeTruthy();
      expect(connection!.userId).toBe(testUser.id);
      expect(connection!.screenName).toBe(testUser.screenName);
      
      done();
    });
  });

  it('should handle disconnect and cleanup properly', (done) => {
    clientSocket.on('connection:established', () => {
      // Verify user is online
      expect(connectionManager.isUserOnline(testUser.id)).toBe(true);
      
      // Disconnect client
      clientSocket.disconnect();
      
      // Give some time for cleanup
      setTimeout(() => {
        expect(connectionManager.isUserOnline(testUser.id)).toBe(false);
        done();
      }, 100);
    });
  });
});