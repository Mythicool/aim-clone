import { Server } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { BuddyRelationshipRepository } from '../../src/repositories/BuddyRelationshipRepository';
import { AuthService } from '../../src/services/AuthService';
import { BuddyService } from '../../src/services/BuddyService';
import { SocketEventHandlers } from '../../src/services/SocketEventHandlers';
import { socketAuthMiddleware } from '../../src/middleware/socketAuthMiddleware';
import { UserStatus } from '../../src/models/User';
import jwt from 'jsonwebtoken';

describe('Status Updates Integration', () => {
  let httpServer: any;
  let io: Server;
  let socketEventHandlers: SocketEventHandlers;
  let dbService: DatabaseService;
  let userRepository: UserRepository;
  let buddyRepository: BuddyRelationshipRepository;
  let authService: AuthService;
  let buddyService: BuddyService;

  let user1: any;
  let user2: any;
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    // Setup database
    dbService = DatabaseService.getInstance();
    await dbService.initialize();
    const db = await dbService.getDb();

    // Initialize repositories and services
    userRepository = new UserRepository(db);
    buddyRepository = new BuddyRelationshipRepository(db);
    authService = new AuthService(userRepository);
    buddyService = new BuddyService(buddyRepository, {} as any, userRepository);

    // Create HTTP server and Socket.io
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Setup socket authentication middleware
    io.use(socketAuthMiddleware);

    // Setup socket event handlers
    socketEventHandlers = new SocketEventHandlers(io);
    io.on('connection', (socket: any) => {
      socketEventHandlers.setupEventHandlers(socket);
    });

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });
  });

  afterAll(async () => {
    socketEventHandlers.cleanup();
    io.close();
    httpServer.close();
    await dbService.close();
  });

  beforeEach(async () => {
    // Create test users
    const user1Token = await authService.register({
      screenName: 'TestUser1',
      password: 'password123',
      email: 'test1@example.com'
    });
    const user2Token = await authService.register({
      screenName: 'TestUser2',
      password: 'password123',
      email: 'test2@example.com'
    });

    user1 = user1Token.user;
    user2 = user2Token.user;

    // Generate tokens
    user1Token = jwt.sign({ userId: user1.id }, process.env.JWT_SECRET || 'test-secret');
    user2Token = jwt.sign({ userId: user2.id }, process.env.JWT_SECRET || 'test-secret');

    // Create buddy relationship (user2 has user1 as buddy)
    await buddyService.addBuddy(user2.id, user1.screenName);
  });

  afterEach(async () => {
    // Clean up database
    const db = await dbService.getDb();
    await db.run('DELETE FROM buddy_relationships');
    await db.run('DELETE FROM users');
  });

  it('should notify buddies when user comes online', (done) => {
    const port = (httpServer.address() as any).port;
    
    // Connect user2 first
    const client2 = Client(`http://localhost:${port}`, {
      auth: { token: user2Token }
    });

    client2.on('connect', () => {
      // Now connect user1
      const client1 = Client(`http://localhost:${port}`, {
        auth: { token: user1Token }
      });

      // User2 should receive notification when user1 comes online
      client2.on('buddy:online', (data) => {
        expect(data.userId).toBe(user1.id);
        expect(data.screenName).toBe(user1.screenName);
        expect(data.status).toBe(UserStatus.ONLINE);

        client1.disconnect();
        client2.disconnect();
        done();
      });
    });
  });

  it('should notify buddies when user goes offline', (done) => {
    const port = (httpServer.address() as any).port;
    
    // Connect both users
    const client1 = Client(`http://localhost:${port}`, {
      auth: { token: user1Token }
    });

    const client2 = Client(`http://localhost:${port}`, {
      auth: { token: user2Token }
    });

    let connectCount = 0;
    const onConnect = () => {
      connectCount++;
      if (connectCount === 2) {
        // Both connected, now disconnect user1
        client1.disconnect();
      }
    };

    client1.on('connect', onConnect);
    client2.on('connect', onConnect);

    // User2 should receive notification when user1 goes offline
    client2.on('buddy:offline', (data) => {
      expect(data.userId).toBe(user1.id);
      expect(data.screenName).toBe(user1.screenName);

      client2.disconnect();
      done();
    });
  });

  it('should notify buddies when user changes status', (done) => {
    const port = (httpServer.address() as any).port;
    
    // Connect both users
    const client1 = Client(`http://localhost:${port}`, {
      auth: { token: user1Token }
    });

    const client2 = Client(`http://localhost:${port}`, {
      auth: { token: user2Token }
    });

    let connectCount = 0;
    const onConnect = () => {
      connectCount++;
      if (connectCount === 2) {
        // Both connected, now change user1's status
        client1.emit('user:status-change', {
          status: UserStatus.AWAY,
          awayMessage: 'Gone for lunch'
        });
      }
    };

    client1.on('connect', onConnect);
    client2.on('connect', onConnect);

    // User2 should receive notification when user1 changes status
    client2.on('buddy:status-change', (data) => {
      expect(data.userId).toBe(user1.id);
      expect(data.screenName).toBe(user1.screenName);
      expect(data.status).toBe(UserStatus.AWAY);
      expect(data.awayMessage).toBe('Gone for lunch');

      client1.disconnect();
      client2.disconnect();
      done();
    });
  });

  it('should handle heartbeat and activity tracking', (done) => {
    const port = (httpServer.address() as any).port;
    
    const client1 = Client(`http://localhost:${port}`, {
      auth: { token: user1Token }
    });

    client1.on('connect', () => {
      // Send heartbeat
      client1.emit('heartbeat');

      // Should receive heartbeat response
      client1.on('heartbeat', () => {
        client1.disconnect();
        done();
      });
    });
  });

  it('should reject invalid status changes', (done) => {
    const port = (httpServer.address() as any).port;
    
    const client1 = Client(`http://localhost:${port}`, {
      auth: { token: user1Token }
    });

    client1.on('connect', () => {
      // Send invalid status
      client1.emit('user:status-change', {
        status: 'invalid_status'
      });

      // Should receive error
      client1.on('error', (error) => {
        expect(error.code).toBe('INVALID_STATUS');
        expect(error.message).toBe('Invalid status value');

        client1.disconnect();
        done();
      });
    });
  });

  it('should not notify non-buddies of status changes', (done) => {
    const port = (httpServer.address() as any).port;
    
    // Create a third user who is not a buddy
    authService.register({
      screenName: 'TestUser3',
      password: 'password123',
      email: 'test3@example.com'
    })
      .then(user3Token => {
        const user3 = user3Token.user;
        const user3TokenString = jwt.sign({ userId: user3.id }, process.env.JWT_SECRET || 'test-secret');
        
        // Connect user1 and user3 (not buddies)
        const client1 = Client(`http://localhost:${port}`, {
          auth: { token: user1Token }
        });

        const client3 = Client(`http://localhost:${port}`, {
          auth: { token: user3TokenString }
        });

        let connectCount = 0;
        let receivedNotification = false;

        const onConnect = () => {
          connectCount++;
          if (connectCount === 2) {
            // Both connected, change user1's status
            client1.emit('user:status-change', {
              status: UserStatus.AWAY,
              awayMessage: 'Testing'
            });

            // Wait a bit to see if user3 receives notification (it shouldn't)
            setTimeout(() => {
              expect(receivedNotification).toBe(false);
              client1.disconnect();
              client3.disconnect();
              done();
            }, 100);
          }
        };

        client1.on('connect', onConnect);
        client3.on('connect', onConnect);

        // User3 should NOT receive notification
        client3.on('buddy:status-change', () => {
          receivedNotification = true;
        });
      });
  });
});