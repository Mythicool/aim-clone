import request from 'supertest';
import { app } from '../../src/index';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { AuthService } from '../../src/services/AuthService';
import { CreateUserData, UserStatus } from '../../src/models/User';

describe('User Routes', () => {
  let dbService: DatabaseService;
  let userRepository: UserRepository;
  let authService: AuthService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    userRepository = new UserRepository(db);
    authService = new AuthService(userRepository);
  });

  beforeEach(async () => {
    // Create a test user and get auth token
    const registerData = {
      screenName: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    };

    const authResult = await authService.register(registerData);
    authToken = authResult.token;
    userId = authResult.user.id;
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile when authenticated', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.displayName).toBe('testuser');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile successfully', async () => {
      const profileData = {
        displayName: 'Updated Name',
        location: 'New York',
        interests: 'Gaming, Music',
        awayMessage: 'Be right back'
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(profileData)
        .expect(200);

      expect(response.body.user.displayName).toBe('Updated Name');
      expect(response.body.user.location).toBe('New York');
      expect(response.body.user.interests).toBe('Gaming, Music');
      expect(response.body.user.awayMessage).toBe('Be right back');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 400 for invalid profile data', async () => {
      const profileData = {
        displayName: 'a'.repeat(51) // Too long
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(profileData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('cannot exceed 50 characters');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({ displayName: 'Test' })
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/users/search/:screenName', () => {
    beforeEach(async () => {
      // Create another user to search for
      const userData: CreateUserData = {
        screenName: 'searchuser',
        email: 'search@example.com',
        passwordHash: 'hashedpassword',
        displayName: 'Search User'
      };
      await userRepository.create(userData);
    });

    it('should find user by screen name', async () => {
      const response = await request(app)
        .get('/api/users/search/searchuser')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user.screenName).toBe('searchuser');
      expect(response.body.user.displayName).toBe('Search User');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 404 for nonexistent user', async () => {
      const response = await request(app)
        .get('/api/users/search/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 400 for empty screen name', async () => {
      const response = await request(app)
        .get('/api/users/search/')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/search/searchuser')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PUT /api/users/status', () => {
    it('should update user status successfully', async () => {
      const response = await request(app)
        .put('/api/users/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: UserStatus.AWAY })
        .expect(200);

      expect(response.body.user.status).toBe(UserStatus.AWAY);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .put('/api/users/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_STATUS');
    });

    it('should return 400 for missing status', async () => {
      const response = await request(app)
        .put('/api/users/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_STATUS');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put('/api/users/status')
        .send({ status: UserStatus.AWAY })
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PUT /api/users/away-message', () => {
    it('should set away message successfully', async () => {
      const response = await request(app)
        .put('/api/users/away-message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Gone for lunch' })
        .expect(200);

      expect(response.body.user.awayMessage).toBe('Gone for lunch');
      expect(response.body.user.status).toBe(UserStatus.AWAY);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 400 for non-string message', async () => {
      const response = await request(app)
        .put('/api/users/away-message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 123 })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 400 for message too long', async () => {
      const longMessage = 'a'.repeat(201);
      const response = await request(app)
        .put('/api/users/away-message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: longMessage })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put('/api/users/away-message')
        .send({ message: 'Away' })
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('DELETE /api/users/away-message', () => {
    beforeEach(async () => {
      // Set an away message first
      await request(app)
        .put('/api/users/away-message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Away message' });
    });

    it('should clear away message successfully', async () => {
      const response = await request(app)
        .delete('/api/users/away-message')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user.awayMessage).toBeNull();
      expect(response.body.user.status).toBe(UserStatus.ONLINE);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .delete('/api/users/away-message')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/users/online', () => {
    beforeEach(async () => {
      // Create additional users with different statuses
      const users = [
        { screenName: 'online1', status: UserStatus.ONLINE },
        { screenName: 'online2', status: UserStatus.AWAY },
        { screenName: 'offline1', status: UserStatus.OFFLINE },
        { screenName: 'invisible1', status: UserStatus.INVISIBLE }
      ];

      for (const userData of users) {
        const createData: CreateUserData = {
          screenName: userData.screenName,
          email: `${userData.screenName}@example.com`,
          passwordHash: 'hashedpassword',
          displayName: userData.screenName
        };
        const user = await userRepository.create(createData);
        await userRepository.updateStatus(user.id, userData.status);
      }
    });

    it('should return only online and away users', async () => {
      const response = await request(app)
        .get('/api/users/online')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(3); // testuser (online), online1, online2 (away)
      const screenNames = response.body.users.map((u: any) => u.screenName);
      expect(screenNames).toContain('testuser');
      expect(screenNames).toContain('online1');
      expect(screenNames).toContain('online2');
      expect(screenNames).not.toContain('offline1');
      expect(screenNames).not.toContain('invisible1');

      // Verify no password hashes are returned
      response.body.users.forEach((user: any) => {
        expect(user).not.toHaveProperty('passwordHash');
      });
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/online')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});