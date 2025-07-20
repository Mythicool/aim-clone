import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');
  
  // Set up test database
  try {
    console.log('📊 Setting up test database...');
    const backendPath = path.join(process.cwd(), 'backend');
    await execAsync('npm run setup-db', { cwd: backendPath });
    console.log('✅ Test database setup complete');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }

  // Wait for servers to be ready
  console.log('⏳ Waiting for servers to be ready...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Verify frontend is accessible
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await browser.close();
    console.log('✅ Frontend server is ready');
  } catch (error) {
    console.error('❌ Frontend server not ready:', error);
    throw error;
  }

  // Verify backend is accessible
  try {
    const response = await fetch('http://localhost:3001/health');
    if (!response.ok) {
      throw new Error(`Backend health check failed: ${response.status}`);
    }
    console.log('✅ Backend server is ready');
  } catch (error) {
    console.error('❌ Backend server not ready:', error);
    throw error;
  }

  console.log('🎉 E2E test setup complete!');
}

export default globalSetup;
