import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { socketAuthMiddleware, AuthenticatedSocket } from '../../src/middleware/socketAuthMiddleware';
import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../src/database/DatabaseService');
jest.mock('../../src/repositories/UserRepository');

describe('socketAuthMiddleware', () => {
  let mockSocket: Partial<Socket>;
  let mockNext: jest.Mock;
  let mockDbService: jest.Mocked<DatabaseService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockSocket = {
      handshake: {
        auth: {}
      }
    } as any;

    mockNext = jest.fn();

    mockDbService = {
      getInstance: jest.fn(),
      getDb: jest.fn()
    } as any;

    mockUserRepository = {
      findById: jest.fn()
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDbService);
    (UserRepository as jest.Mock).mockImplementation(() => mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should authenticate valid token successfully', async () => {
    // Arrange
    const token = 'valid-jwt-token';
    const userId = 'user-123';
    const mockUser = {
      id: userId,
      screenName: 'TestUser',
      email: 'test@example.com'
    };

    mockSocket.handshake!.auth.token = token;
    (jwt.verify as jest.Mock).mockReturnValue({ userId });
    mockDbService.getDb.mockResolvedValue({} as any);
    mockUserRepository.findById.mockResolvedValue(mockUser as any);

    // Act
    await socketAuthMiddleware(mockSocket as Socket, mockNext);

    // Assert
    expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET || 'aim-secret-key-change-in-production');
    expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    expect((mockSocket as AuthenticatedSocket).user).toEqual({
      id: mockUser.id,
      screenName: mockUser.screenName,
      email: mockUser.email
    });
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should reject request without token', async () => {
    // Arrange - no token in handshake.auth

    // Act
    await socketAuthMiddleware(mockSocket as Socket, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalledWith(new Error('Authentication token required'));
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('should reject invalid JWT token', async () => {
    // Arrange
    const token = 'invalid-jwt-token';
    mockSocket.handshake!.auth.token = token;
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new jwt.JsonWebTokenError('Invalid token');
    });

    // Act
    await socketAuthMiddleware(mockSocket as Socket, mockNext);

    // Assert
    expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET || 'aim-secret-key-change-in-production');
    expect(mockNext).toHaveBeenCalledWith(new Error('Invalid authentication token'));
  });

  it('should reject token for non-existent user', async () => {
    // Arrange
    const token = 'valid-jwt-token';
    const userId = 'non-existent-user';

    mockSocket.handshake!.auth.token = token;
    (jwt.verify as jest.Mock).mockReturnValue({ userId });
    mockDbService.getDb.mockResolvedValue({} as any);
    mockUserRepository.findById.mockResolvedValue(null);

    // Act
    await socketAuthMiddleware(mockSocket as Socket, mockNext);

    // Assert
    expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET || 'aim-secret-key-change-in-production');
    expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    expect(mockNext).toHaveBeenCalledWith(new Error('Invalid token - user not found'));
  });

  it('should handle database errors gracefully', async () => {
    // Arrange
    const token = 'valid-jwt-token';
    const userId = 'user-123';

    mockSocket.handshake!.auth.token = token;
    (jwt.verify as jest.Mock).mockReturnValue({ userId });
    mockDbService.getDb.mockRejectedValue(new Error('Database connection failed'));

    // Act
    await socketAuthMiddleware(mockSocket as Socket, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed'));
  });

  it('should handle user repository errors gracefully', async () => {
    // Arrange
    const token = 'valid-jwt-token';
    const userId = 'user-123';

    mockSocket.handshake!.auth.token = token;
    (jwt.verify as jest.Mock).mockReturnValue({ userId });
    mockDbService.getDb.mockResolvedValue({} as any);
    mockUserRepository.findById.mockRejectedValue(new Error('User lookup failed'));

    // Act
    await socketAuthMiddleware(mockSocket as Socket, mockNext);

    // Assert
    expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed'));
  });
});