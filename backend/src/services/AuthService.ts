import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, CreateUserData, UserStatus } from '../models/User';
import { UserRepository } from '../repositories/UserRepository';

export interface AuthToken {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

export interface LoginCredentials {
  screenName: string;
  password: string;
}

export interface RegisterData {
  screenName: string;
  password: string;
  email: string;
}

export class AuthService {
  private jwtSecret: string;
  private saltRounds = 12;

  constructor(private userRepository: UserRepository) {
    this.jwtSecret = process.env.JWT_SECRET || 'aim-secret-key-change-in-production';
  }

  async register(registerData: RegisterData): Promise<AuthToken> {
    const { screenName, password, email } = registerData;

    // Validate input
    this.validateRegistrationData(registerData);

    // Check if screen name or email already exists
    const existingUser = await this.userRepository.findByScreenName(screenName);
    if (existingUser) {
      throw new Error('Screen name already exists');
    }

    const existingEmail = await this.userRepository.findByEmail(email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    // Create user data
    const createUserData: CreateUserData = {
      screenName,
      email,
      passwordHash,
      displayName: screenName // Default display name to screen name
    };

    // Create user
    const user = await this.userRepository.create(createUserData);

    // Set user status to online
    await this.userRepository.updateStatus(user.id, UserStatus.ONLINE);

    // Generate JWT token
    const token = this.generateToken(user.id);

    return {
      token,
      user: this.sanitizeUser(user)
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const { screenName, password } = credentials;

    // Validate input
    this.validateLoginCredentials(credentials);

    // Find user by screen name
    const user = await this.userRepository.findByScreenName(screenName);
    if (!user) {
      throw new Error('Invalid screen name or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid screen name or password');
    }

    // Update user status to online
    await this.userRepository.updateStatus(user.id, UserStatus.ONLINE);

    // Generate JWT token
    const token = this.generateToken(user.id);

    return {
      token,
      user: this.sanitizeUser(user)
    };
  }

  async validateToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      const user = await this.userRepository.findById(decoded.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        throw error;
      }
      throw new Error('Invalid token');
    }
  }

  async logout(userId: string): Promise<void> {
    // Set user status to offline
    await this.userRepository.updateStatus(userId, UserStatus.OFFLINE);
  }

  private generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: '24h' }
    );
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private validateRegistrationData(data: RegisterData): void {
    const { screenName, password, email } = data;

    if (!screenName || screenName.trim().length === 0) {
      throw new Error('Screen name is required');
    }

    if (screenName.length < 3 || screenName.length > 16) {
      throw new Error('Screen name must be between 3 and 16 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(screenName)) {
      throw new Error('Screen name can only contain letters, numbers, and underscores');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    if (!email || !this.isValidEmail(email)) {
      throw new Error('Valid email address is required');
    }
  }

  private validateLoginCredentials(credentials: LoginCredentials): void {
    const { screenName, password } = credentials;

    if (!screenName || screenName.trim().length === 0) {
      throw new Error('Screen name is required');
    }

    if (!password || password.trim().length === 0) {
      throw new Error('Password is required');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}