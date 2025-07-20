import { AuthService, RegisterData, LoginCredentials } from '../../src/services/AuthService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserStatus } from '../../src/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: UserRepository;

  beforeEach(async () => {
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    userRepository = new UserRepository(db);
    authService = new AuthService(userRepository);
  });

  describe('register', () => {
    const validRegisterData: RegisterData = {
      screenName: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    };

    it('should successfully register a new user', async () => {
      const result = await authService.register(validRegisterData);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.screenName).toBe('testuser');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(typeof result.token).toBe('string');
    });

    it('should hash the password correctly', async () => {
      await authService.register(validRegisterData);
      
      const user = await userRepository.findByScreenName('testuser');
      expect(user).toBeTruthy();
      expect(user!.passwordHash).not.toBe('password123');
      
      const isPasswordValid = await bcrypt.compare('password123', user!.passwordHash);
      expect(isPasswordValid).toBe(true);
    });

    it('should set user status to online after registration', async () => {
      await authService.register(validRegisterData);
      
      const user = await userRepository.findByScreenName('testuser');
      expect(user!.status).toBe(UserStatus.ONLINE);
    });

    it('should throw error for duplicate screen name', async () => {
      await authService.register(validRegisterData);
      
      await expect(authService.register(validRegisterData))
        .rejects.toThrow('Screen name already exists');
    });

    it('should throw error for duplicate email', async () => {
      await authService.register(validRegisterData);
      
      const duplicateEmailData = {
        ...validRegisterData,
        screenName: 'differentuser'
      };
      
      await expect(authService.register(duplicateEmailData))
        .rejects.toThrow('Email already exists');
    });

    it('should validate screen name length', async () => {
      const shortScreenName = { ...validRegisterData, screenName: 'ab' };
      await expect(authService.register(shortScreenName))
        .rejects.toThrow('Screen name must be between 3 and 16 characters');

      const longScreenName = { ...validRegisterData, screenName: 'a'.repeat(17) };
      await expect(authService.register(longScreenName))
        .rejects.toThrow('Screen name must be between 3 and 16 characters');
    });

    it('should validate screen name characters', async () => {
      const invalidScreenName = { ...validRegisterData, screenName: 'test@user' };
      await expect(authService.register(invalidScreenName))
        .rejects.toThrow('Screen name can only contain letters, numbers, and underscores');
    });

    it('should validate password length', async () => {
      const shortPassword = { ...validRegisterData, password: '12345' };
      await expect(authService.register(shortPassword))
        .rejects.toThrow('Password must be at least 6 characters long');
    });

    it('should validate email format', async () => {
      const invalidEmail = { ...validRegisterData, email: 'invalid-email' };
      await expect(authService.register(invalidEmail))
        .rejects.toThrow('Valid email address is required');
    });

    it('should require all fields', async () => {
      await expect(authService.register({ ...validRegisterData, screenName: '' }))
        .rejects.toThrow('Screen name is required');

      await expect(authService.register({ ...validRegisterData, password: '' }))
        .rejects.toThrow('Password must be at least 6 characters long');

      await expect(authService.register({ ...validRegisterData, email: '' }))
        .rejects.toThrow('Valid email address is required');
    });
  });

  describe('login', () => {
    const registerData: RegisterData = {
      screenName: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    };

    const loginCredentials: LoginCredentials = {
      screenName: 'testuser',
      password: 'password123'
    };

    beforeEach(async () => {
      // Create a user for login tests
      await authService.register(registerData);
      // Set user offline to test login status change
      await userRepository.updateStatus((await userRepository.findByScreenName('testuser'))!.id, UserStatus.OFFLINE);
    });

    it('should successfully login with valid credentials', async () => {
      const result = await authService.login(loginCredentials);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.screenName).toBe('testuser');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(typeof result.token).toBe('string');
    });

    it('should set user status to online after login', async () => {
      await authService.login(loginCredentials);
      
      const user = await userRepository.findByScreenName('testuser');
      expect(user!.status).toBe(UserStatus.ONLINE);
    });

    it('should throw error for non-existent user', async () => {
      const invalidCredentials = { ...loginCredentials, screenName: 'nonexistent' };
      await expect(authService.login(invalidCredentials))
        .rejects.toThrow('Invalid screen name or password');
    });

    it('should throw error for wrong password', async () => {
      const invalidCredentials = { ...loginCredentials, password: 'wrongpassword' };
      await expect(authService.login(invalidCredentials))
        .rejects.toThrow('Invalid screen name or password');
    });

    it('should be case insensitive for screen name', async () => {
      const upperCaseCredentials = { ...loginCredentials, screenName: 'TESTUSER' };
      const result = await authService.login(upperCaseCredentials);
      expect(result.user.screenName).toBe('testuser');
    });

    it('should require screen name and password', async () => {
      await expect(authService.login({ ...loginCredentials, screenName: '' }))
        .rejects.toThrow('Screen name is required');

      await expect(authService.login({ ...loginCredentials, password: '' }))
        .rejects.toThrow('Password is required');
    });
  });

  describe('validateToken', () => {
    let validToken: string;
    let userId: string;

    beforeEach(async () => {
      const registerData: RegisterData = {
        screenName: 'testuser',
        password: 'password123',
        email: 'test@example.com'
      };
      
      const result = await authService.register(registerData);
      validToken = result.token;
      userId = result.user.id;
    });

    it('should validate a valid token', async () => {
      const user = await authService.validateToken(validToken);
      
      expect(user.id).toBe(userId);
      expect(user.screenName).toBe('testuser');
    });

    it('should throw error for invalid token', async () => {
      await expect(authService.validateToken('invalid-token'))
        .rejects.toThrow('Invalid token');
    });

    it('should throw error for expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '-1h' }
      );

      await expect(authService.validateToken(expiredToken))
        .rejects.toThrow('Invalid token');
    });

    it('should throw error for token with non-existent user', async () => {
      // Create token with fake user ID
      const fakeToken = jwt.sign(
        { userId: 'fake-user-id' },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h' }
      );

      await expect(authService.validateToken(fakeToken))
        .rejects.toThrow('User not found');
    });
  });

  describe('logout', () => {
    let userId: string;

    beforeEach(async () => {
      const registerData: RegisterData = {
        screenName: 'testuser',
        password: 'password123',
        email: 'test@example.com'
      };
      
      const result = await authService.register(registerData);
      userId = result.user.id;
    });

    it('should set user status to offline', async () => {
      await authService.logout(userId);
      
      const user = await userRepository.findById(userId);
      expect(user!.status).toBe(UserStatus.OFFLINE);
    });

    it('should handle logout for non-existent user gracefully', async () => {
      // Should not throw error
      await expect(authService.logout('fake-user-id')).resolves.toBeUndefined();
    });
  });
});