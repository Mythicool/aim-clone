import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { TEST_USERS, registerUser, loginUser, addBuddy, sendMessage, waitForSound } from '../utils/test-helpers';

test.describe('UI Interactions and Notifications', () => {
  let browser: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
  });

  test.beforeEach(async () => {
    // Create two separate browser contexts
    context1 = await browser.newContext();
    context2 = await browser.newContext();
    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Register and login both users
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    await registerUser(page1, user1);
    await loginUser(page1, user1);

    await registerUser(page2, user2);
    await loginUser(page2, user2);

    // Add each other as buddies
    await addBuddy(page1, user2.username);
    await addBuddy(page2, user1.username);
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
  });

  test('should play sound when buddy comes online', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 2 goes offline first
    await context2.close();

    // Wait for offline status
    await expect(
      page1.locator(`[data-testid="buddy-${user2.username}"][data-status="offline"]`)
    ).toBeVisible({ timeout: 10000 });

    // User 2 comes back online
    context2 = await browser.newContext();
    page2 = await context2.newPage();
    await loginUser(page2, user2);

    // Should play buddy online sound
    await waitForSound(page1, 'buddy-online');
  });

  test('should play sound when buddy goes offline', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Verify both users are online
    await expect(
      page1.locator(`[data-testid="buddy-${user2.username}"][data-status="online"]`)
    ).toBeVisible();

    // User 2 goes offline
    await context2.close();

    // Should play buddy offline sound
    await waitForSound(page1, 'buddy-offline');
  });

  test('should play sound when receiving message', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 sends message to User 2
    await sendMessage(page1, user2.username, 'Hello!');

    // Should play message received sound on User 2's side
    await waitForSound(page2, 'message-received');
  });

  test('should flash window title when receiving message in background', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Minimize or blur User 2's window to simulate background
    await page2.evaluate(() => {
      window.blur();
    });

    // User 1 sends message
    await sendMessage(page1, user2.username, 'Background message');

    // Window title should flash
    await expect(page2).toHaveTitle(/\*.*AIM/);
  });

  test('should manage multiple chat windows', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const user3 = TEST_USERS.user3;

    // Register and login third user
    const context3 = await browser.newContext();
    const page3 = await context3.newPage();
    await registerUser(page3, user3);
    await loginUser(page3, user3);

    // Add user3 as buddy
    await addBuddy(page1, user3.username);

    // Open chat windows with both users
    await page1.click(`[data-testid="buddy-${user2.username}"]`);
    await page1.click(`[data-testid="buddy-${user3.username}"]`);

    // Verify both chat windows are open
    await expect(page1.locator(`[data-testid="chat-window-${user2.username}"]`)).toBeVisible();
    await expect(page1.locator(`[data-testid="chat-window-${user3.username}"]`)).toBeVisible();

    // Close one chat window
    await page1.click(`[data-testid="chat-window-${user2.username}"] [data-testid="close-button"]`);

    // Verify only one chat window remains
    await expect(page1.locator(`[data-testid="chat-window-${user2.username}"]`)).not.toBeVisible();
    await expect(page1.locator(`[data-testid="chat-window-${user3.username}"]`)).toBeVisible();

    await context3.close();
  });

  test('should handle window focus and blur events', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Open chat window
    await sendMessage(page1, user2.username, 'Test message');

    // Focus chat window
    await page1.click(`[data-testid="chat-window-${user2.username}"]`);

    // Verify window has focus styling
    await expect(
      page1.locator(`[data-testid="chat-window-${user2.username}"][data-focused="true"]`)
    ).toBeVisible();

    // Click outside to blur
    await page1.click('[data-testid="buddy-list"]');

    // Verify window loses focus styling
    await expect(
      page1.locator(`[data-testid="chat-window-${user2.username}"][data-focused="false"]`)
    ).toBeVisible();
  });

  test('should show unread message indicators', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 sends message to User 2
    await sendMessage(page1, user2.username, 'Unread message');

    // User 2 should see unread indicator on buddy
    await expect(
      page2.locator(`[data-testid="buddy-${user1.username}"] [data-testid="unread-indicator"]`)
    ).toBeVisible();

    // Open chat window to read message
    await page2.click(`[data-testid="buddy-${user1.username}"]`);

    // Unread indicator should disappear
    await expect(
      page2.locator(`[data-testid="buddy-${user1.username}"] [data-testid="unread-indicator"]`)
    ).not.toBeVisible();
  });

  test('should handle sound preferences', async () => {
    // Open preferences window
    await page1.click('[data-testid="menu-button"]');
    await page1.click('[data-testid="preferences"]');

    // Navigate to sound settings
    await page1.click('[data-testid="sound-preferences"]');

    // Disable message sounds
    await page1.uncheck('[data-testid="message-sounds-enabled"]');
    await page1.click('[data-testid="save-preferences"]');

    // Send message - should not play sound
    await sendMessage(page2, TEST_USERS.user1.username, 'Silent message');

    // Verify no sound was played
    await expect(page1.locator('[data-testid="sound-played"]')).not.toBeVisible();
  });

  test('should handle keyboard shortcuts', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Open chat window
    await page1.click(`[data-testid="buddy-${user2.username}"]`);

    // Test Ctrl+Enter to send message
    const messageInput = page1.locator(`[data-testid="chat-window-${user2.username}"] [data-testid="message-input"]`);
    await messageInput.fill('Keyboard shortcut message');
    await messageInput.press('Control+Enter');

    // Message should be sent
    await expect(
      page1.locator(`[data-testid="chat-window-${user2.username}"] text=Keyboard shortcut message`)
    ).toBeVisible();

    // Test Escape to close window
    await page1.press('Escape');

    // Chat window should close
    await expect(page1.locator(`[data-testid="chat-window-${user2.username}"]`)).not.toBeVisible();
  });

  test('should handle window positioning and resizing', async () => {
    const user2 = TEST_USERS.user2;

    // Open chat window
    await page1.click(`[data-testid="buddy-${user2.username}"]`);

    const chatWindow = page1.locator(`[data-testid="chat-window-${user2.username}"]`);

    // Test window dragging
    await chatWindow.locator('[data-testid="title-bar"]').dragTo(
      page1.locator('body'),
      { targetPosition: { x: 300, y: 200 } }
    );

    // Verify window moved
    const windowBox = await chatWindow.boundingBox();
    expect(windowBox?.x).toBeGreaterThan(250);
    expect(windowBox?.y).toBeGreaterThan(150);

    // Test window resizing
    await chatWindow.locator('[data-testid="resize-handle"]').dragTo(
      page1.locator('body'),
      { targetPosition: { x: 400, y: 300 } }
    );

    // Verify window resized
    const newWindowBox = await chatWindow.boundingBox();
    expect(newWindowBox?.width).toBeGreaterThan(windowBox?.width || 0);
  });

  test('should show typing indicators with animation', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Open chat windows
    await page1.click(`[data-testid="buddy-${user2.username}"]`);
    await page2.click(`[data-testid="buddy-${user1.username}"]`);

    // User 1 starts typing
    const messageInput = page1.locator(`[data-testid="chat-window-${user2.username}"] [data-testid="message-input"]`);
    await messageInput.fill('User is typing...');

    // User 2 should see animated typing indicator
    const typingIndicator = page2.locator(`[data-testid="chat-window-${user1.username}"] [data-testid="typing-indicator"]`);
    await expect(typingIndicator).toBeVisible();
    await expect(typingIndicator.locator('[data-testid="typing-dots"]')).toHaveClass(/animated/);

    // Stop typing
    await messageInput.clear();

    // Typing indicator should disappear
    await expect(typingIndicator).not.toBeVisible();
  });

  test('should handle notification permissions', async () => {
    // Grant notification permissions
    await page1.context().grantPermissions(['notifications']);

    // Send message from user 2
    await sendMessage(page2, TEST_USERS.user1.username, 'Notification test');

    // Should trigger browser notification
    await expect(page1.locator('[data-testid="notification-triggered"]')).toBeVisible();
  });

  test('should handle window minimize and restore', async () => {
    const user2 = TEST_USERS.user2;

    // Open chat window
    await page1.click(`[data-testid="buddy-${user2.username}"]`);

    const chatWindow = page1.locator(`[data-testid="chat-window-${user2.username}"]`);

    // Minimize window
    await chatWindow.locator('[data-testid="minimize-button"]').click();

    // Window should be minimized
    await expect(chatWindow).toHaveClass(/minimized/);

    // Restore window by clicking on taskbar or buddy
    await page1.click(`[data-testid="buddy-${user2.username}"]`);

    // Window should be restored
    await expect(chatWindow).not.toHaveClass(/minimized/);
  });
});
