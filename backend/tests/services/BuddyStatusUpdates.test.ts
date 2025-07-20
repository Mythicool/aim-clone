import { DatabaseService } from '../../src/database/DatabaseService';
import { UserRepository } from '../../src/repositories/UserRepository';
import { BuddyRelationshipRepository } from '../../src/repositories/BuddyRelationshipRepository';
import { AuthService } from '../../src/services/AuthService';
import { BuddyService } from '../../src/services/BuddyService';
import { UserStatus } from '../../src/models/User';

describe('Buddy Status Updates', () => {
  let dbService: DatabaseService;
  let userRepository: UserRepository;
  let buddyRepository: BuddyRelationshipRepository;
  let authService: AuthService;
  let buddyService: BuddyService;

  let user1: any;
  let user2: any;

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
  });

  afterAll(async () => {
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

    // Create buddy relationship (user2 has user1 as buddy)
    await buddyService.addBuddy(user2.id, user1.screenName);
  });

  afterEach(async () => {
    // Clean up database
    const db = await dbService.getDb();
    await db.run('DELETE FROM buddy_relationships');
    await db.run('DELETE FROM users');
  });

  describe('Buddy Relationship Queries', () => {
    it('should find users who have a specific user as buddy', async () => {
      // Test the new method we added
      const usersWithBuddy = await buddyRepository.findUsersWithBuddy(user1.id);
      
      expect(usersWithBuddy).toHaveLength(1);
      expect(usersWithBuddy[0].userId).toBe(user2.id);
      expect(usersWithBuddy[0].buddyId).toBe(user1.id);
    });

    it('should return empty array when no users have the buddy', async () => {
      // Create a third user that no one has as buddy
      const user3Token = await authService.register({
        screenName: 'TestUser3',
        password: 'password123',
        email: 'test3@example.com'
      });

      const usersWithBuddy = await buddyRepository.findUsersWithBuddy(user3Token.user.id);
      
      expect(usersWithBuddy).toHaveLength(0);
    });

    it('should handle bidirectional buddy relationships', async () => {
      // Add user1 as buddy of user2 as well (making it bidirectional)
      await buddyService.addBuddy(user1.id, user2.screenName);

      // Now both users should have each other as buddies
      const usersWithUser1AsBuddy = await buddyRepository.findUsersWithBuddy(user1.id);
      const usersWithUser2AsBuddy = await buddyRepository.findUsersWithBuddy(user2.id);

      expect(usersWithUser1AsBuddy).toHaveLength(1);
      expect(usersWithUser1AsBuddy[0].userId).toBe(user2.id);

      expect(usersWithUser2AsBuddy).toHaveLength(1);
      expect(usersWithUser2AsBuddy[0].userId).toBe(user1.id);
    });
  });

  describe('User Status Updates', () => {
    it('should update user status in database', async () => {
      // Update user status
      await userRepository.updateStatus(user1.id, UserStatus.AWAY);

      // Verify status was updated
      const updatedUser = await userRepository.findById(user1.id);
      expect(updatedUser?.status).toBe(UserStatus.AWAY);
    });

    it('should update user profile with away message', async () => {
      // Update user with away message
      await userRepository.update(user1.id, {
        status: UserStatus.AWAY,
        awayMessage: 'Gone for lunch'
      });

      // Verify both status and away message were updated
      const updatedUser = await userRepository.findById(user1.id);
      expect(updatedUser?.status).toBe(UserStatus.AWAY);
      expect(updatedUser?.awayMessage).toBe('Gone for lunch');
    });

    it('should handle status transitions correctly', async () => {
      // Test various status transitions
      const statuses = [UserStatus.ONLINE, UserStatus.AWAY, UserStatus.INVISIBLE, UserStatus.OFFLINE];

      for (const status of statuses) {
        await userRepository.updateStatus(user1.id, status);
        const updatedUser = await userRepository.findById(user1.id);
        expect(updatedUser?.status).toBe(status);
      }
    });
  });

  describe('Buddy List with Status', () => {
    it('should get buddy list with current status', async () => {
      // Update user1 status
      await userRepository.updateStatus(user1.id, UserStatus.AWAY);

      // Get user2's buddy list (which includes user1)
      const buddyList = await buddyService.getBuddyList(user2.id);

      expect(buddyList).toHaveLength(1);
      expect(buddyList[0].buddy.id).toBe(user1.id);
      expect(buddyList[0].buddy.status).toBe(UserStatus.AWAY);
    });

    it('should filter online buddies correctly', async () => {
      // Set user1 to online
      await userRepository.updateStatus(user1.id, UserStatus.ONLINE);

      // Get online buddies for user2
      const onlineBuddies = await buddyService.getOnlineBuddies(user2.id);

      expect(onlineBuddies).toHaveLength(1);
      expect(onlineBuddies[0].buddy.status).toBe(UserStatus.ONLINE);
    });

    it('should filter offline buddies correctly', async () => {
      // Set user1 to offline
      await userRepository.updateStatus(user1.id, UserStatus.OFFLINE);

      // Get offline buddies for user2
      const offlineBuddies = await buddyService.getOfflineBuddies(user2.id);

      expect(offlineBuddies).toHaveLength(1);
      expect(offlineBuddies[0].buddy.status).toBe(UserStatus.OFFLINE);
    });
  });
});