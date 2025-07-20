import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { TEST_USERS, registerUser, loginUser, sendMessage, waitForMessage, addBuddy } from '../utils/test-helpers';

test.describe('Real-time Messaging', () => {
  let browser: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
  });

  test.beforeEach(async () => {
    // Create two separate browser contexts for two users
    context1 = await browser.newContext();
    context2 = await browser.newContext();
    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Register and login both users
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 setup
    await registerUser(page1, user1);
    await loginUser(page1, user1);

    // User 2 setup  
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

  test('should send and receive messages between users', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const message = 'Hello from user1!';

    // User 1 sends message to User 2
    await sendMessage(page1, user2.username, message);

    // User 2 should receive the message
    await waitForMessage(page2, user1.username, message);

    // Verify message appears in both chat windows
    const chatWindow1 = page1.locator(`[data-testid="chat-window-${user2.username}"]`);
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);

    await expect(chatWindow1.locator(`text=${message}`)).toBeVisible();
    await expect(chatWindow2.locator(`text=${message}`)).toBeVisible();
  });

  test('should support bidirectional messaging', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const message1 = 'Hello from user1!';
    const message2 = 'Hi back from user2!';

    // User 1 sends message
    await sendMessage(page1, user2.username, message1);
    await waitForMessage(page2, user1.username, message1);

    // User 2 replies
    await sendMessage(page2, user1.username, message2);
    await waitForMessage(page1, user2.username, message2);

    // Verify both messages in both chat windows
    const chatWindow1 = page1.locator(`[data-testid="chat-window-${user2.username}"]`);
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);

    await expect(chatWindow1.locator(`text=${message1}`)).toBeVisible();
    await expect(chatWindow1.locator(`text=${message2}`)).toBeVisible();
    await expect(chatWindow2.locator(`text=${message1}`)).toBeVisible();
    await expect(chatWindow2.locator(`text=${message2}`)).toBeVisible();
  });

  test('should handle multiple messages in sequence', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const messages = [
      'First message',
      'Second message',
      'Third message'
    ];

    // Send multiple messages
    for (const message of messages) {
      await sendMessage(page1, user2.username, message);
      await waitForMessage(page2, user1.username, message);
    }

    // Verify all messages are visible in correct order
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);
    for (const message of messages) {
      await expect(chatWindow2.locator(`text=${message}`)).toBeVisible();
    }
  });

  test('should display message timestamps', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const message = 'Message with timestamp';

    await sendMessage(page1, user2.username, message);
    await waitForMessage(page2, user1.username, message);

    // Check for timestamp in both chat windows
    const chatWindow1 = page1.locator(`[data-testid="chat-window-${user2.username}"]`);
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);

    await expect(chatWindow1.locator('[data-testid="message-timestamp"]')).toBeVisible();
    await expect(chatWindow2.locator('[data-testid="message-timestamp"]')).toBeVisible();
  });

  test('should show sender names correctly', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const message = 'Test sender name';

    await sendMessage(page1, user2.username, message);
    await waitForMessage(page2, user1.username, message);

    // In user1's chat window, message should show as sent by user1
    const chatWindow1 = page1.locator(`[data-testid="chat-window-${user2.username}"]`);
    await expect(chatWindow1.locator(`[data-testid="message-sender"]:has-text("${user1.username}")`)).toBeVisible();

    // In user2's chat window, message should show as received from user1
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);
    await expect(chatWindow2.locator(`[data-testid="message-sender"]:has-text("${user1.username}")`)).toBeVisible();
  });

  test('should handle special characters and emojis', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const message = 'Special chars: !@#$%^&*() and emoji: 😀🎉';

    await sendMessage(page1, user2.username, message);
    await waitForMessage(page2, user1.username, message);

    // Verify special characters are preserved
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);
    await expect(chatWindow2.locator(`text=${message}`)).toBeVisible();
  });

  test('should handle long messages', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const longMessage = 'This is a very long message that should test how the chat window handles text wrapping and display of lengthy content. '.repeat(5);

    await sendMessage(page1, user2.username, longMessage);
    await waitForMessage(page2, user1.username, longMessage);

    // Verify long message is displayed correctly
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);
    await expect(chatWindow2.locator(`text=${longMessage.substring(0, 50)}`)).toBeVisible();
  });

  test('should maintain message history', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const message1 = 'First message';
    const message2 = 'Second message';

    // Send messages
    await sendMessage(page1, user2.username, message1);
    await waitForMessage(page2, user1.username, message1);
    
    await sendMessage(page1, user2.username, message2);
    await waitForMessage(page2, user1.username, message2);

    // Close and reopen chat window
    await page2.click(`[data-testid="chat-window-${user1.username}"] [data-testid="close-button"]`);
    await page2.click(`[data-testid="buddy-${user1.username}"]`);

    // Verify message history is preserved
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);
    await expect(chatWindow2.locator(`text=${message1}`)).toBeVisible();
    await expect(chatWindow2.locator(`text=${message2}`)).toBeVisible();
  });

  test('should handle rapid message sending', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const messages = Array.from({ length: 10 }, (_, i) => `Rapid message ${i + 1}`);

    // Send messages rapidly
    for (const message of messages) {
      await sendMessage(page1, user2.username, message);
    }

    // Wait for all messages to be received
    for (const message of messages) {
      await waitForMessage(page2, user1.username, message);
    }

    // Verify all messages are visible
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);
    for (const message of messages) {
      await expect(chatWindow2.locator(`text=${message}`)).toBeVisible();
    }
  });

  test('should show typing indicators', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 starts typing
    const messageInput = page1.locator(`[data-testid="chat-window-${user2.username}"] [data-testid="message-input"]`);
    await messageInput.fill('User is typing...');

    // User 2 should see typing indicator
    const chatWindow2 = page2.locator(`[data-testid="chat-window-${user1.username}"]`);
    await expect(chatWindow2.locator('[data-testid="typing-indicator"]')).toBeVisible();

    // Send the message
    await messageInput.press('Enter');

    // Typing indicator should disappear
    await expect(chatWindow2.locator('[data-testid="typing-indicator"]')).not.toBeVisible();
  });
});
