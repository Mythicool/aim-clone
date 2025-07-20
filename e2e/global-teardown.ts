import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test teardown...');
  
  // Clean up test database
  try {
    const dbPath = path.join(process.cwd(), 'backend', 'data', 'aim.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✅ Test database cleaned up');
    }
  } catch (error) {
    console.warn('⚠️ Failed to clean up test database:', error);
  }

  console.log('🎉 E2E test teardown complete!');
}

export default globalTeardown;
