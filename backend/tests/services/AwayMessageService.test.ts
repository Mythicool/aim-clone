import { UserService } from '../../src/services/UserService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { UserStatus } from '../../src/models/User';

// Mock the UserRepository
jest.mock('../../src/repositories/UserRepository');

describe('Away Message Service Tests', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock repository
    mockUserRepository = new UserRepository(null as any) as jest.Mocked<UserRepository>;
    
    // Create service with mock repository
    userService = new UserService(mockUserRepository);
  });

  describe('updateUserStatus', () => {
    it('should update status without away message for non-away status', async () => {
      // Setup
      const userId = 'user123';
      const status = UserStatus.ONLINE;
      const mockUser = { id: userId, status };
      
      mockUserRepository.update.mockResolvedValue(mockUser as any);
      
      // Execute
      await userService.updateUserStatus(userId, status);
      
      // Verify
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { status });
    });

    it('should update status and away message for AWAY status', async () => {
      // Setup
      const userId = 'user123';
      const status = UserStatus.AWAY;
      const awayMessage = 'Gone for lunch';
      const mockUser = { id: userId, status, awayMessage };
      
      mockUserRepository.update.mockResolvedValue(mockUser as any);
      
      // Execute
      await userService.updateUserStatus(userId, status, awayMessage);
      
      // Verify
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { 
        status, 
        awayMessage 
      });
    });

    it('should clear away message when changing from AWAY to another status', async () => {
      // Setup
      const userId = 'user123';
      const status = UserStatus.ONLINE;
      const mockUser = { id: userId, status, awayMessage: null };
      
      mockUserRepository.update.mockResolvedValue(mockUser as any);
      
      // Execute
      await userService.updateUserStatus(userId, status);
      
      // Verify
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { 
        status,
        awayMessage: null
      });
    });
  });

  describe('setAwayMessage', () => {
    it('should set away message and update status to AWAY', async () => {
      // Setup
      const userId = 'user123';
      const awayMessage = 'Be back soon';
      const mockUser = { id: userId, status: UserStatus.AWAY, awayMessage };
      
      mockUserRepository.update.mockResolvedValue(mockUser as any);
      
      // Execute
      await userService.setAwayMessage(userId, awayMessage);
      
      // Verify
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { 
        status: UserStatus.AWAY,
        awayMessage
      });
    });

    it('should sanitize away message', async () => {
      // Setup
      const userId = 'user123';
      const dirtyAwayMessage = '<script>alert("XSS")</script>Gone fishing';
      const cleanAwayMessage = 'Gone fishing';
      const mockUser = { id: userId, status: UserStatus.AWAY, awayMessage: cleanAwayMessage };
      
      mockUserRepository.update.mockResolvedValue(mockUser as any);
      
      // Execute
      await userService.setAwayMessage(userId, dirtyAwayMessage);
      
      // Verify - should have sanitized the message
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId, 
        expect.objectContaining({ 
          awayMessage: expect.not.stringContaining('<script>') 
        })
      );
    });

    it('should throw error if away message exceeds max length', async () => {
      // Setup
      const userId = 'user123';
      const longAwayMessage = 'A'.repeat(201); // 201 characters
      
      // Execute & Verify
      await expect(userService.setAwayMessage(userId, longAwayMessage))
        .rejects
        .toThrow('Away message cannot exceed 200 characters');
    });
  });

  describe('clearAwayMessage', () => {
    it('should clear away message and set status to ONLINE', async () => {
      // Setup
      const userId = 'user123';
      const mockUser = { id: userId, status: UserStatus.ONLINE, awayMessage: null };
      
      mockUserRepository.update.mockResolvedValue(mockUser as any);
      
      // Execute
      await userService.clearAwayMessage(userId);
      
      // Verify
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { 
        status: UserStatus.ONLINE,
        awayMessage: null
      });
    });
  });
});