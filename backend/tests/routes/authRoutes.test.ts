import request from 'supertest';
import express from 'express';
import { DatabaseService } from '../../src/database/DatabaseService';
import authRoutes from '../../src/routes/authRoutes';
import { UserRepository } from '../../src/repositories/UserRepository';
import { UserStatus } from '../../src/models/User';

describe('Auth Routes', () => {
  let app: express.Application;
  let userRepository: UserRepository;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    userRepository = new UserRepository(db);
  });

  describe('POST /api/auth/register', () => {
    const validRegisterData = {
      screenName: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.screenName).toBe('testuser');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ screenName: 'testuser' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('required');
    });

    it('should return 400 for invalid screen name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegisterData, screenName: 'ab' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Screen name must be between 3 and 16 characters');
    });

    it('should return 400 for duplicate screen name', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(validRegisterData)
        .expect(201);

      // Try to register with same screen name
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Screen name already exists');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegisterData, email: 'invalid-email' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Valid email address is required');
    });
  });

  describe('POST /api/auth/login', () => {
    const registerData = {
      screenName: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    };

    const loginCredentials = {
      screenName: 'testuser',
      password: 'password123'
    };

    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(registerData);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginCredentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.screenName).toBe('testuser');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ screenName: 'testuser' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('required');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ ...loginCredentials, password: 'wrongpassword' })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toBe('Invalid screen name or password');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ screenName: 'nonexistent', password: 'password123' })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toBe('Invalid screen name or password');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          screenName: 'testuser',
          password: 'password123',
          email: 'test@example.com'
        });

      authToken = registerResponse.body.data.token;
      userId = registerResponse.body.data.user.id;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');

      // Verify user status is set to offline
      const user = await userRepository.findById(userId);
      expect(user!.status).toBe(UserStatus.OFFLINE);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Access token is required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Invalid token');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          screenName: 'testuser',
          password: 'password123',
          email: 'test@example.com'
        });

      authToken = registerResponse.body.data.token;
      userId = registerResponse.body.data.user.id;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(userId);
      expect(response.body.data.screenName).toBe('testuser');
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/validate', () => {
    let authToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          screenName: 'testuser',
          password: 'password123',
          email: 'test@example.com'
        });

      authToken = registerResponse.body.data.token;
    });

    it('should validate a valid token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: authToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.screenName).toBe('testuser');
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Token is required');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
      expect(response.body.error.message).toBe('Invalid or expired token');
    });
  });
});