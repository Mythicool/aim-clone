import { test, expect, Page } from '@playwright/test';
import { TEST_USERS, registerUser, loginUser } from '../utils/test-helpers';

test.describe('User Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto('/');
  });

  test('should display login window on initial load', async ({ page }) => {
    // Verify login window is displayed
    await expect(page.locator('[data-testid="login-window"]')).toBeVisible();
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    
    // Verify register link is present
    await expect(page.locator('text=Register')).toBeVisible();
  });

  test('should successfully register a new user', async ({ page }) => {
    const user = TEST_USERS.user1;
    
    // Navigate to registration
    await page.click('text=Register');
    await expect(page.locator('[data-testid="registration-window"]')).toBeVisible();
    
    // Fill registration form
    await page.fill('[data-testid="username-input"]', user.username);
    await page.fill('[data-testid="email-input"]', user.email);
    await page.fill('[data-testid="password-input"]', user.password);
    await page.fill('[data-testid="confirm-password-input"]', user.password);
    
    // Submit registration
    await page.click('[data-testid="register-button"]');
    
    // Verify success message
    await expect(page.locator('text=Registration successful')).toBeVisible();
    
    // Should redirect to login
    await expect(page.locator('[data-testid="login-window"]')).toBeVisible();
  });

  test('should show validation errors for invalid registration', async ({ page }) => {
    // Navigate to registration
    await page.click('text=Register');
    
    // Try to register with empty fields
    await page.click('[data-testid="register-button"]');
    
    // Verify validation errors
    await expect(page.locator('text=Username is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
    
    // Try with mismatched passwords
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.fill('[data-testid="confirm-password-input"]', 'different');
    
    await page.click('[data-testid="register-button"]');
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    const user = TEST_USERS.user1;
    
    // First register the user
    await registerUser(page, user);
    
    // Now login
    await loginUser(page, user);
    
    // Verify we're logged in (buddy list should be visible)
    await expect(page.locator('[data-testid="buddy-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-window"]')).toBeVisible();
    
    // Verify user info is displayed
    await expect(page.locator(`text=${user.username}`)).toBeVisible();
  });

  test('should show error for invalid login credentials', async ({ page }) => {
    // Try to login with non-existent user
    await page.fill('[data-testid="username-input"]', 'nonexistent');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Verify error message
    await expect(page.locator('text=Invalid username or password')).toBeVisible();
    
    // Should still be on login page
    await expect(page.locator('[data-testid="login-window"]')).toBeVisible();
  });

  test('should show error for empty login fields', async ({ page }) => {
    // Try to login with empty fields
    await page.click('[data-testid="login-button"]');
    
    // Verify validation errors
    await expect(page.locator('text=Username is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('should maintain session after page refresh', async ({ page }) => {
    const user = TEST_USERS.user2;
    
    // Register and login
    await registerUser(page, user);
    await loginUser(page, user);
    
    // Verify logged in
    await expect(page.locator('[data-testid="buddy-list"]')).toBeVisible();
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page.locator('[data-testid="buddy-list"]')).toBeVisible();
    await expect(page.locator(`text=${user.username}`)).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    const user = TEST_USERS.user3;
    
    // Register and login
    await registerUser(page, user);
    await loginUser(page, user);
    
    // Verify logged in
    await expect(page.locator('[data-testid="buddy-list"]')).toBeVisible();
    
    // Logout
    await page.click('[data-testid="menu-button"]');
    await page.click('[data-testid="logout-button"]');
    
    // Should return to login page
    await expect(page.locator('[data-testid="login-window"]')).toBeVisible();
    await expect(page.locator('[data-testid="buddy-list"]')).not.toBeVisible();
  });

  test('should prevent duplicate username registration', async ({ page }) => {
    const user = TEST_USERS.user1;
    
    // Register user first time
    await registerUser(page, user);
    
    // Try to register same username again
    await page.click('text=Register');
    await page.fill('[data-testid="username-input"]', user.username);
    await page.fill('[data-testid="email-input"]', 'different@example.com');
    await page.fill('[data-testid="password-input"]', user.password);
    await page.fill('[data-testid="confirm-password-input"]', user.password);
    
    await page.click('[data-testid="register-button"]');
    
    // Should show error
    await expect(page.locator('text=Username already exists')).toBeVisible();
  });
});
