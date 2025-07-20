import { DatabaseService } from '../src/database/DatabaseService';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Global test setup
beforeAll(async () => {
  // Initialize test database
  const dbService = DatabaseService.getInstance();
  await dbService.initialize();
});

afterAll(async () => {
  // Clean up database connection
  const dbService = DatabaseService.getInstance();
  await dbService.close();
});

// Clean up database before each test
beforeEach(async () => {
  const dbService = DatabaseService.getInstance();
  const db = await dbService.getDb();
  
  // Clear all tables
  await db.exec(`
    DELETE FROM messages;
    DELETE FROM buddy_relationships;
    DELETE FROM users;
  `);
});