import { DatabaseService } from '../src/database/DatabaseService';
import { AuthService } from '../src/services/AuthService';
import { BuddyService } from '../src/services/BuddyService';
import { UserStatus } from '../src/models/User';

async function addTestData() {
  const dbService = DatabaseService.getInstance();

  try {
    console.log('Initializing database...');
    await dbService.initialize();

    const userRepository = dbService.getUserRepository();
    const authService = new AuthService(userRepository);
    
    // Create test users
    console.log('Creating test users...');
    
    let user1, user2, user3;
    
    try {
      user1 = await authService.register({
        screenName: 'testuser1',
        password: 'password123',
        email: 'testuser1@example.com'
      });
      console.log('Created user1:', user1.screenName);
    } catch (error) {
      console.log('User1 already exists, fetching...');
      user1 = await userRepository.findByScreenName('testuser1');
    }

    try {
      user2 = await authService.register({
        screenName: 'testuser2',
        password: 'password123',
        email: 'testuser2@example.com'
      });
      console.log('Created user2:', user2.screenName);
    } catch (error) {
      console.log('User2 already exists, fetching...');
      user2 = await userRepository.findByScreenName('testuser2');
    }

    try {
      user3 = await authService.register({
        screenName: 'testuser3',
        password: 'password123',
        email: 'testuser3@example.com'
      });
      console.log('Created user3:', user3.screenName);
    } catch (error) {
      console.log('User3 already exists, fetching...');
      user3 = await userRepository.findByScreenName('testuser3');
    }
    
    if (!user1 || !user2 || !user3) {
      throw new Error('Failed to create or find test users');
    }
    
    // Create buddy service
    const buddyRepository = dbService.getBuddyRelationshipRepository();
    const buddyRequestRepository = dbService.getBuddyRequestRepository();
    const buddyService = new BuddyService(buddyRepository, buddyRequestRepository, userRepository);
    
    // Add buddy relationships
    console.log('Creating buddy relationships...');
    
    try {
      // User1 adds User2 as buddy
      await buddyService.addBuddy(user1.id, user2.screenName, 'Friends');
      console.log('Added user2 as buddy to user1');
    } catch (error) {
      console.log('Buddy relationship user1->user2 already exists');
    }
    
    try {
      // User1 adds User3 as buddy
      await buddyService.addBuddy(user1.id, user3.screenName, 'Work');
      console.log('Added user3 as buddy to user1');
    } catch (error) {
      console.log('Buddy relationship user1->user3 already exists');
    }
    
    try {
      // User2 adds User1 as buddy (mutual)
      await buddyService.addBuddy(user2.id, user1.screenName, 'Friends');
      console.log('Added user1 as buddy to user2');
    } catch (error) {
      console.log('Buddy relationship user2->user1 already exists');
    }
    
    // Set users as online
    console.log('Setting users as online...');
    await userRepository.updateStatus(user1.id, UserStatus.ONLINE);
    await userRepository.updateStatus(user2.id, UserStatus.ONLINE);
    await userRepository.updateStatus(user3.id, UserStatus.AWAY);
    
    console.log('Test data setup completed successfully!');
    console.log('You can now log in with:');
    console.log('- testuser1 / password123');
    console.log('- testuser2 / password123');
    console.log('- testuser3 / password123');
    
  } catch (error) {
    console.error('Test data setup error:', error);
    process.exit(1);
  } finally {
    await dbService.close();
  }
}

addTestData();
