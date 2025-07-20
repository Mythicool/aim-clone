import { Router, Request, Response } from 'express';
import { DatabaseService } from '../database/DatabaseService';
import { AuthService } from '../services/AuthService';
import { BuddyService } from '../services/BuddyService';
import { UserStatus } from '../models/User';

const router = Router();

// Initialize test data endpoint
router.post('/init-test-data', async (req: Request, res: Response) => {
  try {
    console.log('Initializing test data...');
    
    const dbService = DatabaseService.getInstance();
    const userRepository = dbService.getUserRepository();
    const authService = new AuthService(userRepository);
    
    // Create test users
    const testUsers = [
      { screenName: 'testuser1', password: 'password123', email: 'testuser1@example.com' },
      { screenName: 'testuser2', password: 'password123', email: 'testuser2@example.com' },
      { screenName: 'testuser3', password: 'password123', email: 'testuser3@example.com' }
    ];
    
    const createdUsers = [];
    
    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existingUser = await userRepository.findByScreenName(userData.screenName);
        if (existingUser) {
          console.log(`User ${userData.screenName} already exists, skipping...`);
          createdUsers.push(existingUser);
          continue;
        }
        
        // Create new user
        const user = await authService.register({
          screenName: userData.screenName,
          password: userData.password,
          email: userData.email
        });
        
        console.log(`Created user: ${user.user.screenName}`);
        createdUsers.push(user.user);
      } catch (error) {
        console.log(`Error creating user ${userData.screenName}:`, error);
        // If user already exists, try to find them
        const existingUser = await userRepository.findByScreenName(userData.screenName);
        if (existingUser) {
          createdUsers.push(existingUser);
        }
      }
    }
    
    if (createdUsers.length < 3) {
      return res.status(500).json({
        error: 'Failed to create all test users',
        created: createdUsers.length
      });
    }
    
    // Create buddy relationships
    const buddyRepository = dbService.getBuddyRelationshipRepository();
    const buddyRequestRepository = dbService.getBuddyRequestRepository();
    const buddyService = new BuddyService(buddyRepository, buddyRequestRepository, userRepository);
    
    const [user1, user2, user3] = createdUsers;
    
    try {
      // User1 adds User2 as buddy
      await buddyService.addBuddy(user1.id, user2.screenName, 'Friends');
      console.log('Added user2 as buddy to user1');
    } catch (error) {
      console.log('Buddy relationship user1->user2 already exists or failed');
    }
    
    try {
      // User1 adds User3 as buddy
      await buddyService.addBuddy(user1.id, user3.screenName, 'Work');
      console.log('Added user3 as buddy to user1');
    } catch (error) {
      console.log('Buddy relationship user1->user3 already exists or failed');
    }
    
    try {
      // User2 adds User1 as buddy (mutual)
      await buddyService.addBuddy(user2.id, user1.screenName, 'Friends');
      console.log('Added user1 as buddy to user2');
    } catch (error) {
      console.log('Buddy relationship user2->user1 already exists or failed');
    }
    
    // Set users as online
    await userRepository.updateStatus(user1.id, UserStatus.ONLINE);
    await userRepository.updateStatus(user2.id, UserStatus.ONLINE);
    await userRepository.updateStatus(user3.id, UserStatus.AWAY);
    
    console.log('Test data initialization completed successfully!');
    
    res.json({
      success: true,
      message: 'Test data initialized successfully',
      users: createdUsers.map(user => ({
        id: user.id,
        screenName: user.screenName,
        email: user.email
      })),
      credentials: [
        'testuser1 / password123',
        'testuser2 / password123',
        'testuser3 / password123'
      ]
    });
    
  } catch (error) {
    console.error('Test data initialization error:', error);
    res.status(500).json({
      error: 'Failed to initialize test data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check for admin routes
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'Admin routes are working',
    timestamp: new Date().toISOString()
  });
});

export default router;
