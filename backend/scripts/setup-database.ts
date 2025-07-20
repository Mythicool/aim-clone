import { DatabaseService } from '../src/database/DatabaseService';

async function setupDatabase() {
  const dbService = DatabaseService.getInstance();
  
  try {
    console.log('Setting up database...');
    await dbService.initialize();
    
    console.log('Running health check...');
    const health = await dbService.healthCheck();
    console.log('Database status:', health);
    
    if (health.status === 'healthy') {
      console.log('Database setup completed successfully!');
    } else {
      console.error('Database setup failed:', health.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Database setup error:', error);
    process.exit(1);
  } finally {
    await dbService.close();
  }
}

setupDatabase();