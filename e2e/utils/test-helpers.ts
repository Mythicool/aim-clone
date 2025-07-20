import { Page, expect } from '@playwright/test';

export interface TestUser {
  username: string;
  password: string;
  email: string;
}

export const TEST_USERS = {
  user1: {
    username: 'testuser1',
    password: 'password123',
    email: 'testuser1@example.com'
  },
  user2: {
    username: 'testuser2', 
    password: 'password123',
    email: 'testuser2@example.com'
  },
  user3: {
    username: 'testuser3',
    password: 'password123', 
    email: 'testuser3@example.com'
  }
} as const;

/**
 * Register a new user through the UI
 */
export async function registerUser(page: Page, user: TestUser) {
  await page.goto('/');
  
  // Click register link
  await page.click('text=Register');
  
  // Fill registration form
  await page.fill('[data-testid="username-input"]', user.username);
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.fill('[data-testid="confirm-password-input"]', user.password);
  
  // Submit registration
  await page.click('[data-testid="register-button"]');
  
  // Wait for registration success
  await expect(page.locator('text=Registration successful')).toBeVisible();
}

/**
 * Login a user through the UI
 */
export async function loginUser(page: Page, user: TestUser) {
  await page.goto('/');
  
  // Fill login form
  await page.fill('[data-testid="username-input"]', user.username);
  await page.fill('[data-testid="password-input"]', user.password);
  
  // Submit login
  await page.click('[data-testid="login-button"]');
  
  // Wait for buddy list to appear (indicates successful login)
  await expect(page.locator('[data-testid="buddy-list"]')).toBeVisible();
}

/**
 * Wait for a user to appear online in buddy list
 */
export async function waitForBuddyOnline(page: Page, username: string) {
  await expect(
    page.locator(`[data-testid="buddy-${username}"][data-status="online"]`)
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for a user to appear offline in buddy list
 */
export async function waitForBuddyOffline(page: Page, username: string) {
  await expect(
    page.locator(`[data-testid="buddy-${username}"][data-status="offline"]`)
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Send a message in a chat window
 */
export async function sendMessage(page: Page, recipientUsername: string, message: string) {
  // Open chat window if not already open
  const chatWindow = page.locator(`[data-testid="chat-window-${recipientUsername}"]`);
  if (!(await chatWindow.isVisible())) {
    await page.click(`[data-testid="buddy-${recipientUsername}"]`);
    await expect(chatWindow).toBeVisible();
  }
  
  // Type and send message
  const messageInput = chatWindow.locator('[data-testid="message-input"]');
  await messageInput.fill(message);
  await messageInput.press('Enter');
}

/**
 * Wait for a message to appear in chat window
 */
export async function waitForMessage(page: Page, senderUsername: string, message: string) {
  const chatWindow = page.locator(`[data-testid="chat-window-${senderUsername}"]`);
  await expect(
    chatWindow.locator(`[data-testid="message"]:has-text("${message}")`)
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Add a buddy through the UI
 */
export async function addBuddy(page: Page, buddyUsername: string) {
  // Right-click on buddy list to open context menu
  await page.click('[data-testid="buddy-list"]', { button: 'right' });
  
  // Click "Add Buddy" option
  await page.click('text=Add Buddy');
  
  // Fill buddy username
  await page.fill('[data-testid="buddy-username-input"]', buddyUsername);
  
  // Click Add button
  await page.click('[data-testid="add-buddy-button"]');
  
  // Wait for buddy to appear in list
  await expect(page.locator(`[data-testid="buddy-${buddyUsername}"]`)).toBeVisible();
}

/**
 * Set user status
 */
export async function setStatus(page: Page, status: 'online' | 'away' | 'offline') {
  await page.click('[data-testid="status-dropdown"]');
  await page.click(`[data-testid="status-${status}"]`);
}

/**
 * Set away message
 */
export async function setAwayMessage(page: Page, message: string) {
  await page.click('[data-testid="status-dropdown"]');
  await page.click('[data-testid="set-away-message"]');
  await page.fill('[data-testid="away-message-input"]', message);
  await page.click('[data-testid="save-away-message"]');
}

/**
 * Wait for sound to play (checks for sound manager activity)
 */
export async function waitForSound(page: Page, soundType: string) {
  await expect(
    page.locator(`[data-testid="sound-played"][data-sound="${soundType}"]`)
  ).toBeVisible({ timeout: 5000 });
}
