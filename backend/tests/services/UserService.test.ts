import { UserService, UserProfileUpdate } from '../../src/services/UserService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { DatabaseService } from '../../src/database/DatabaseService';
import { User, UserStatus, CreateUserData } from '../../src/models/User';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: UserRepository;
  let dbService: DatabaseService;

  beforeAll(async () => {
    dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    userRepository = new UserRepository(db);
    userService = new UserService(userRepository);
  });

  // Helper function to create a test user
  const createTestUser = async (screenName: string = 'testuser'): Promise<User> => {
    const userData: CreateUserData = {
      screenName,
      email: `${screenName}@test.com`,
      passwordHash: 'hashedpassword123',
      displayName: screenName
    };
    return await userRepository.create(userData);
  };

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const createdUser = await createTestUser('testuser1');
      
      const result = await userService.getUserById(createdUser.id);
      
      expect(result).toBeTruthy();
      expect(result?.id).toBe(createdUser.id);
      expect(result?.screenName).toBe('testuser1');
    });

    it('should return null when user not found', async () => {
      const result = await userService.getUserById('nonexistent-id');
      
      expect(result).toBeNull();
    });
  });

  describe('getUserByScreenName', () => {
    it('should return user when found', async () => {
      await createTestUser('findme');
      
      const result = await userService.getUserByScreenName('findme');
      
      expect(result).toBeTruthy();
      expect(result?.screenName).toBe('findme');
    });

    it('should return null when user not found', async () => {
      const result = await userService.getUserByScreenName('nonexistent');
      
      expect(result).toBeNull();
    });

    it('should be case insensitive', async () => {
      await createTestUser('CaseSensitive');
      
      const result = await userService.getUserByScreenName('casesensitive');
      
      expect(result).toBeTruthy();
      expect(result?.screenName).toBe('CaseSensitive');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', async () => {
      const user = await createTestUser('statususer');
      
      const result = await userService.updateUserStatus(user.id, UserStatus.AWAY);
      
      expect(result).toBeTruthy();
      expect(result?.status).toBe(UserStatus.AWAY);
    });

    it('should return null for nonexistent user', async () => {
      const result = await userService.updateUserStatus('nonexistent-id', UserStatus.ONLINE);
      
      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully with valid data', async () => {
      const user = await createTestUser('profileuser');
      const profileData: UserProfileUpdate = {
        displayName: 'New Display Name',
        location: 'New York',
        interests: 'Gaming, Music',
        awayMessage: 'Be right back'
      };
      
      const result = await userService.updateProfile(user.id, profileData);
      
      expect(result).toBeTruthy();
      expect(result?.displayName).toBe('New Display Name');
      expect(result?.location).toBe('New York');
      expect(result?.interests).toBe('Gaming, Music');
      expect(result?.awayMessage).toBe('Be right back');
    });

    it('should sanitize profile data', async () => {
      const user = await createTestUser('sanitizeuser');
      const profileData: UserProfileUpdate = {
        displayName: '  Trimmed Name  ',
        location: '  Trimmed Location  ',
        interests: '  Trimmed Interests  ',
        awayMessage: '<script>alert("xss")</script>Clean message'
      };
      
      const result = await userService.updateProfile(user.id, profileData);
      
      expect(result?.displayName).toBe('Trimmed Name');
      expect(result?.location).toBe('Trimmed Location');
      expect(result?.interests).toBe('Trimmed Interests');
      expect(result?.awayMessage).toBe('Clean message');
    });

    it('should handle empty strings as null', async () => {
      const user = await createTestUser('emptyuser');
      const profileData: UserProfileUpdate = {
        displayName: '',
        location: '   ',
        interests: '',
        awayMessage: ''
      };
      
      const result = await userService.updateProfile(user.id, profileData);
      
      expect(result?.displayName).toBeNull();
      expect(result?.location).toBeNull();
      expect(result?.interests).toBeNull();
      expect(result?.awayMessage).toBeNull();
    });

    it('should validate display name length', async () => {
      const user = await createTestUser('validationuser');
      const profileData: UserProfileUpdate = {
        displayName: 'a'.repeat(51) // 51 characters, exceeds limit
      };
      
      await expect(userService.updateProfile(user.id, profileData))
        .rejects.toThrow('Display name cannot exceed 50 characters');
    });

    it('should validate location length', async () => {
      const user = await createTestUser('locationuser');
      const profileData: UserProfileUpdate = {
        location: 'a'.repeat(101) // 101 characters, exceeds limit
      };
      
      await expect(userService.updateProfile(user.id, profileData))
        .rejects.toThrow('Location cannot exceed 100 characters');
    });

    it('should validate interests length', async () => {
      const user = await createTestUser('interestsuser');
      const profileData: UserProfileUpdate = {
        interests: 'a'.repeat(501) // 501 characters, exceeds limit
      };
      
      await expect(userService.updateProfile(user.id, profileData))
        .rejects.toThrow('Interests cannot exceed 500 characters');
    });

    it('should validate away message length', async () => {
      const user = await createTestUser('awaymsguser');
      const profileData: UserProfileUpdate = {
        awayMessage: 'a'.repeat(201) // 201 characters, exceeds limit
      };
      
      await expect(userService.updateProfile(user.id, profileData))
        .rejects.toThrow('Away message cannot exceed 200 characters');
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile when user exists', async () => {
      const user = await createTestUser('profilegetuser');
      await userService.updateProfile(user.id, {
        displayName: 'Test Display',
        location: 'Test Location',
        interests: 'Test Interests',
        awayMessage: 'Test Away'
      });
      
      const profile = await userService.getUserProfile(user.id);
      
      expect(profile).toBeTruthy();
      expect(profile?.displayName).toBe('Test Display');
      expect(profile?.location).toBe('Test Location');
      expect(profile?.interests).toBe('Test Interests');
      expect(profile?.awayMessage).toBe('Test Away');
    });

    it('should return null when user does not exist', async () => {
      const profile = await userService.getUserProfile('nonexistent-id');
      
      expect(profile).toBeNull();
    });
  });

  describe('getOnlineUsers', () => {
    it('should return only online and away users', async () => {
      const user1 = await createTestUser('online1');
      const user2 = await createTestUser('online2');
      const user3 = await createTestUser('offline1');
      
      await userService.updateUserStatus(user1.id, UserStatus.ONLINE);
      await userService.updateUserStatus(user2.id, UserStatus.AWAY);
      await userService.updateUserStatus(user3.id, UserStatus.OFFLINE);
      
      const onlineUsers = await userService.getOnlineUsers();
      
      expect(onlineUsers).toHaveLength(2);
      expect(onlineUsers.map(u => u.screenName)).toContain('online1');
      expect(onlineUsers.map(u => u.screenName)).toContain('online2');
      expect(onlineUsers.map(u => u.screenName)).not.toContain('offline1');
    });

    it('should return empty array when no users are online', async () => {
      const user = await createTestUser('offlineonly');
      await userService.updateUserStatus(user.id, UserStatus.OFFLINE);
      
      const onlineUsers = await userService.getOnlineUsers();
      
      expect(onlineUsers).toHaveLength(0);
    });
  });

  describe('setAwayMessage', () => {
    it('should set away message and status', async () => {
      const user = await createTestUser('awaymsgsetuser');
      
      const result = await userService.setAwayMessage(user.id, 'Gone for lunch');
      
      expect(result).toBeTruthy();
      expect(result?.awayMessage).toBe('Gone for lunch');
      expect(result?.status).toBe(UserStatus.AWAY);
    });

    it('should sanitize away message', async () => {
      const user = await createTestUser('awaymsgsan');
      
      const result = await userService.setAwayMessage(user.id, '<b>Bold</b> message');
      
      expect(result?.awayMessage).toBe('Bold message');
    });

    it('should validate away message length', async () => {
      const user = await createTestUser('awaymsgval');
      const longMessage = 'a'.repeat(201);
      
      await expect(userService.setAwayMessage(user.id, longMessage))
        .rejects.toThrow('Away message cannot exceed 200 characters');
    });
  });

  describe('clearAwayMessage', () => {
    it('should clear away message and set status to online', async () => {
      const user = await createTestUser('awaymsgclear');
      await userService.setAwayMessage(user.id, 'Away message');
      
      const result = await userService.clearAwayMessage(user.id);
      
      expect(result).toBeTruthy();
      expect(result?.awayMessage).toBeNull();
      expect(result?.status).toBe(UserStatus.ONLINE);
    });
  });

  describe('sanitizeUser', () => {
    it('should remove password hash from user object', async () => {
      const user = await createTestUser('sanitizetest');
      
      const sanitized = userService.sanitizeUser(user);
      
      expect(sanitized).not.toHaveProperty('passwordHash');
      expect(sanitized.id).toBe(user.id);
      expect(sanitized.screenName).toBe(user.screenName);
      expect(sanitized.email).toBe(user.email);
    });
  });
});