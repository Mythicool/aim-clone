import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { TEST_USERS, registerUser, loginUser, addBuddy, setStatus, setAwayMessage, sendMessage } from '../utils/test-helpers';

test.describe('Status and Away Messages', () => {
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

  test('should change status to away', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 changes status to away
    await setStatus(page1, 'away');

    // Verify status change in UI
    await expect(page1.locator('[data-testid="current-status"]:has-text("Away")')).toBeVisible();

    // User 2 should see User 1 as away
    await expect(
      page2.locator(`[data-testid="buddy-${user1.username}"][data-status="away"]`)
    ).toBeVisible({ timeout: 10000 });
  });

  test('should set and display away message', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const awayMessage = 'Gone for lunch, back in 30 minutes';

    // User 1 sets away message
    await setAwayMessage(page1, awayMessage);

    // Verify away message is set
    await expect(page1.locator(`[data-testid="away-message"]:has-text("${awayMessage}")`)).toBeVisible();

    // User 2 should see the away message when viewing User 1's profile
    await page2.click(`[data-testid="buddy-${user1.username}"]`, { button: 'right' });
    await page2.click('[data-testid="view-profile"]');
    await expect(page2.locator(`text=${awayMessage}`)).toBeVisible();
  });

  test('should show away message when messaging away user', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const awayMessage = 'In a meeting, will respond later';

    // User 1 sets away message and status
    await setAwayMessage(page1, awayMessage);
    await setStatus(page1, 'away');

    // User 2 tries to send message to User 1
    await sendMessage(page2, user1.username, 'Hello, are you there?');

    // Away message should be displayed in chat window
    const chatWindow = page2.locator(`[data-testid="chat-window-${user1.username}"]`);
    await expect(chatWindow.locator(`[data-testid="away-message-display"]:has-text("${awayMessage}")`)).toBeVisible();
  });

  test('should handle automatic idle detection', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Simulate user inactivity by not interacting with the page
    // Note: This test may need to be adjusted based on actual idle timeout implementation
    
    // Wait for idle timeout (assuming 5 minutes for testing, but could be shorter)
    await page1.waitForTimeout(5000); // Shortened for testing

    // Trigger idle detection check
    await page1.evaluate(() => {
      // Simulate idle detection trigger
      window.dispatchEvent(new Event('idle-check'));
    });

    // User should automatically be set to away
    await expect(page1.locator('[data-testid="current-status"]:has-text("Away")')).toBeVisible();

    // User 2 should see User 1 as away
    await expect(
      page2.locator(`[data-testid="buddy-${user1.username}"][data-status="away"]`)
    ).toBeVisible({ timeout: 10000 });
  });

  test('should return from away when user becomes active', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 manually sets status to away
    await setStatus(page1, 'away');

    // Verify away status
    await expect(page1.locator('[data-testid="current-status"]:has-text("Away")')).toBeVisible();

    // User becomes active (simulate mouse movement or key press)
    await page1.mouse.move(100, 100);
    await page1.waitForTimeout(1000);

    // User should automatically return to online
    await expect(page1.locator('[data-testid="current-status"]:has-text("Online")')).toBeVisible();

    // User 2 should see User 1 as online
    await expect(
      page2.locator(`[data-testid="buddy-${user1.username}"][data-status="online"]`)
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle custom status messages', async () => {
    const user1 = TEST_USERS.user1;
    const customStatus = 'Working on important project';

    // Set custom status
    await page1.click('[data-testid="status-dropdown"]');
    await page1.click('[data-testid="custom-status"]');
    await page1.fill('[data-testid="custom-status-input"]', customStatus);
    await page1.click('[data-testid="save-status"]');

    // Verify custom status is displayed
    await expect(page1.locator(`[data-testid="current-status"]:has-text("${customStatus}")`)).toBeVisible();
  });

  test('should persist away message across sessions', async () => {
    const user1 = TEST_USERS.user1;
    const awayMessage = 'Persistent away message';

    // Set away message
    await setAwayMessage(page1, awayMessage);

    // Refresh page
    await page1.reload();

    // Wait for page to load
    await expect(page1.locator('[data-testid="buddy-list"]')).toBeVisible();

    // Away message should still be set
    await expect(page1.locator(`[data-testid="away-message"]:has-text("${awayMessage}")`)).toBeVisible();
  });

  test('should show different status icons', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Test online status icon
    await setStatus(page1, 'online');
    await expect(page2.locator(`[data-testid="buddy-${user1.username}"] [data-testid="status-icon-online"]`)).toBeVisible();

    // Test away status icon
    await setStatus(page1, 'away');
    await expect(page2.locator(`[data-testid="buddy-${user1.username}"] [data-testid="status-icon-away"]`)).toBeVisible();

    // Test offline status icon (when user disconnects)
    await context1.close();
    context1 = await browser.newContext();
    page1 = await context1.newPage();
    
    await expect(page2.locator(`[data-testid="buddy-${user1.username}"] [data-testid="status-icon-offline"]`)).toBeVisible();
  });

  test('should handle status change notifications', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 changes status to away
    await setStatus(page1, 'away');

    // User 2 should receive status change notification
    await expect(page2.locator(`[data-testid="status-notification"]:has-text("${user1.username} is now away")`)).toBeVisible();

    // User 1 changes back to online
    await setStatus(page1, 'online');

    // User 2 should receive online notification
    await expect(page2.locator(`[data-testid="status-notification"]:has-text("${user1.username} is now online")`)).toBeVisible();
  });

  test('should clear away message when going online', async () => {
    const user1 = TEST_USERS.user1;
    const awayMessage = 'Temporary away message';

    // Set away message and status
    await setAwayMessage(page1, awayMessage);
    await setStatus(page1, 'away');

    // Verify away message is set
    await expect(page1.locator(`[data-testid="away-message"]:has-text("${awayMessage}")`)).toBeVisible();

    // Change status back to online
    await setStatus(page1, 'online');

    // Away message should be cleared (optional behavior)
    // This test may need adjustment based on actual implementation
    await expect(page1.locator('[data-testid="away-message"]')).not.toBeVisible();
  });

  test('should handle multiple status changes rapidly', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Rapidly change status multiple times
    await setStatus(page1, 'away');
    await setStatus(page1, 'online');
    await setStatus(page1, 'away');
    await setStatus(page1, 'online');

    // Final status should be online
    await expect(page1.locator('[data-testid="current-status"]:has-text("Online")')).toBeVisible();
    await expect(
      page2.locator(`[data-testid="buddy-${user1.username}"][data-status="online"]`)
    ).toBeVisible({ timeout: 10000 });
  });
});
