import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { TEST_USERS, registerUser, loginUser, addBuddy, waitForBuddyOnline, waitForBuddyOffline, setStatus } from '../utils/test-helpers';

test.describe('Buddy List Management', () => {
  let browser: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;
  let context3: BrowserContext;
  let page1: Page;
  let page2: Page;
  let page3: Page;

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
  });

  test.beforeEach(async () => {
    // Create three separate browser contexts for three users
    context1 = await browser.newContext();
    context2 = await browser.newContext();
    context3 = await browser.newContext();
    page1 = await context1.newPage();
    page2 = await context2.newPage();
    page3 = await context3.newPage();

    // Register and login all users
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const user3 = TEST_USERS.user3;

    await registerUser(page1, user1);
    await loginUser(page1, user1);

    await registerUser(page2, user2);
    await loginUser(page2, user2);

    await registerUser(page3, user3);
    await loginUser(page3, user3);
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
    await context3.close();
  });

  test('should add buddy successfully', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 adds User 2 as buddy
    await addBuddy(page1, user2.username);

    // Verify buddy appears in list
    await expect(page1.locator(`[data-testid="buddy-${user2.username}"]`)).toBeVisible();
    
    // Verify buddy shows as online
    await waitForBuddyOnline(page1, user2.username);
  });

  test('should show real-time buddy status updates', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Add each other as buddies
    await addBuddy(page1, user2.username);
    await addBuddy(page2, user1.username);

    // Verify both users see each other as online
    await waitForBuddyOnline(page1, user2.username);
    await waitForBuddyOnline(page2, user1.username);

    // User 2 goes away
    await setStatus(page2, 'away');

    // User 1 should see User 2 as away
    await expect(
      page1.locator(`[data-testid="buddy-${user2.username}"][data-status="away"]`)
    ).toBeVisible({ timeout: 10000 });

    // User 2 goes back online
    await setStatus(page2, 'online');

    // User 1 should see User 2 as online again
    await waitForBuddyOnline(page1, user2.username);
  });

  test('should handle buddy going offline', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Add each other as buddies
    await addBuddy(page1, user2.username);
    await addBuddy(page2, user1.username);

    // Verify both users see each other as online
    await waitForBuddyOnline(page1, user2.username);
    await waitForBuddyOnline(page2, user1.username);

    // User 2 closes browser (goes offline)
    await context2.close();

    // User 1 should see User 2 as offline
    await waitForBuddyOffline(page1, user2.username);
  });

  test('should remove buddy successfully', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Add buddy first
    await addBuddy(page1, user2.username);
    await expect(page1.locator(`[data-testid="buddy-${user2.username}"]`)).toBeVisible();

    // Right-click on buddy to open context menu
    await page1.click(`[data-testid="buddy-${user2.username}"]`, { button: 'right' });

    // Click remove buddy option
    await page1.click('[data-testid="remove-buddy"]');

    // Confirm removal
    await page1.click('[data-testid="confirm-remove"]');

    // Verify buddy is removed from list
    await expect(page1.locator(`[data-testid="buddy-${user2.username}"]`)).not.toBeVisible();
  });

  test('should display buddy profile information', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // Add buddy
    await addBuddy(page1, user2.username);

    // Right-click on buddy to open context menu
    await page1.click(`[data-testid="buddy-${user2.username}"]`, { button: 'right' });

    // Click view profile option
    await page1.click('[data-testid="view-profile"]');

    // Verify profile window opens
    await expect(page1.locator('[data-testid="profile-window"]')).toBeVisible();
    await expect(page1.locator(`text=${user2.username}`)).toBeVisible();
    await expect(page1.locator(`text=${user2.email}`)).toBeVisible();
  });

  test('should organize buddies by status groups', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const user3 = TEST_USERS.user3;

    // Add both users as buddies
    await addBuddy(page1, user2.username);
    await addBuddy(page1, user3.username);

    // Set different statuses
    await setStatus(page2, 'away');
    await setStatus(page3, 'online');

    // Verify buddies are grouped correctly
    const onlineGroup = page1.locator('[data-testid="online-buddies"]');
    const awayGroup = page1.locator('[data-testid="away-buddies"]');

    await expect(onlineGroup.locator(`[data-testid="buddy-${user3.username}"]`)).toBeVisible();
    await expect(awayGroup.locator(`[data-testid="buddy-${user2.username}"]`)).toBeVisible();
  });

  test('should handle buddy request system', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 sends buddy request to User 2
    await page1.click('[data-testid="buddy-list"]', { button: 'right' });
    await page1.click('[data-testid="add-buddy"]');
    await page1.fill('[data-testid="buddy-username-input"]', user2.username);
    await page1.click('[data-testid="send-request"]');

    // User 2 should receive buddy request notification
    await expect(page2.locator('[data-testid="buddy-request-notification"]')).toBeVisible();
    await expect(page2.locator(`text=Buddy request from ${user1.username}`)).toBeVisible();

    // User 2 accepts the request
    await page2.click('[data-testid="accept-buddy-request"]');

    // Both users should now see each other in buddy lists
    await expect(page1.locator(`[data-testid="buddy-${user2.username}"]`)).toBeVisible();
    await expect(page2.locator(`[data-testid="buddy-${user1.username}"]`)).toBeVisible();
  });

  test('should handle buddy request rejection', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;

    // User 1 sends buddy request to User 2
    await page1.click('[data-testid="buddy-list"]', { button: 'right' });
    await page1.click('[data-testid="add-buddy"]');
    await page1.fill('[data-testid="buddy-username-input"]', user2.username);
    await page1.click('[data-testid="send-request"]');

    // User 2 receives and rejects the request
    await expect(page2.locator('[data-testid="buddy-request-notification"]')).toBeVisible();
    await page2.click('[data-testid="reject-buddy-request"]');

    // Neither user should see the other in buddy lists
    await expect(page1.locator(`[data-testid="buddy-${user2.username}"]`)).not.toBeVisible();
    await expect(page2.locator(`[data-testid="buddy-${user1.username}"]`)).not.toBeVisible();

    // User 1 should receive rejection notification
    await expect(page1.locator(`text=Buddy request rejected by ${user2.username}`)).toBeVisible();
  });

  test('should show buddy count in groups', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const user3 = TEST_USERS.user3;

    // Add buddies
    await addBuddy(page1, user2.username);
    await addBuddy(page1, user3.username);

    // Set different statuses
    await setStatus(page2, 'online');
    await setStatus(page3, 'away');

    // Verify group counts
    await expect(page1.locator('[data-testid="online-count"]:has-text("1")')).toBeVisible();
    await expect(page1.locator('[data-testid="away-count"]:has-text("1")')).toBeVisible();
  });

  test('should handle buddy search functionality', async () => {
    const user1 = TEST_USERS.user1;
    const user2 = TEST_USERS.user2;
    const user3 = TEST_USERS.user3;

    // Add multiple buddies
    await addBuddy(page1, user2.username);
    await addBuddy(page1, user3.username);

    // Use search functionality
    await page1.fill('[data-testid="buddy-search"]', user2.username);

    // Only matching buddy should be visible
    await expect(page1.locator(`[data-testid="buddy-${user2.username}"]`)).toBeVisible();
    await expect(page1.locator(`[data-testid="buddy-${user3.username}"]`)).not.toBeVisible();

    // Clear search
    await page1.fill('[data-testid="buddy-search"]', '');

    // All buddies should be visible again
    await expect(page1.locator(`[data-testid="buddy-${user2.username}"]`)).toBeVisible();
    await expect(page1.locator(`[data-testid="buddy-${user3.username}"]`)).toBeVisible();
  });
});
