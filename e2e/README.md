# End-to-End Integration Tests

This directory contains comprehensive end-to-end integration tests for the AOL Instant Messenger clone application. These tests verify complete user workflows across both frontend and backend components.

## Test Coverage

### 1. Authentication Flow (`01-auth-flow.spec.ts`)
- User registration with validation
- User login with error handling
- Session persistence
- Logout functionality
- Duplicate username prevention

### 2. Real-time Messaging (`02-messaging.spec.ts`)
- Message sending and receiving between users
- Bidirectional messaging
- Multiple message sequences
- Message timestamps and sender information
- Special characters and emoji support
- Long message handling
- Message history persistence
- Rapid message sending
- Typing indicators

### 3. Buddy List Management (`03-buddy-management.spec.ts`)
- Adding and removing buddies
- Real-time status updates
- Buddy request system
- Buddy profile viewing
- Status grouping and organization
- Buddy search functionality
- Online/offline status tracking

### 4. Status and Away Messages (`04-status-away-messages.spec.ts`)
- Status changes (online, away, offline)
- Away message setting and display
- Automatic idle detection
- Custom status messages
- Status persistence across sessions
- Status change notifications
- Multiple rapid status changes

### 5. UI Interactions and Notifications (`05-ui-notifications.spec.ts`)
- Sound notifications for various events
- Window title flashing for background messages
- Multiple chat window management
- Window focus and blur handling
- Unread message indicators
- Sound preference settings
- Keyboard shortcuts
- Window positioning and resizing
- Typing indicator animations
- Browser notification permissions
- Window minimize and restore

## Setup and Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npm run install-browsers
```

## Running Tests

### Run all E2E tests:
```bash
npm test
```

### Run tests with UI mode (interactive):
```bash
npm run test:ui
```

### Run tests in headed mode (visible browser):
```bash
npm run test:headed
```

### Debug tests:
```bash
npm run test:debug
```

### View test report:
```bash
npm run report
```

## Test Configuration

The tests are configured in `playwright.config.ts` with the following settings:

- **Base URL**: http://localhost:5173 (frontend)
- **Backend URL**: http://localhost:3001 (backend)
- **Browser**: Chromium (can be extended to Firefox and Safari)
- **Parallel execution**: Disabled for e2e tests to prevent interference
- **Retries**: 2 retries on CI, 0 locally
- **Timeout**: 30 seconds per test
- **Screenshots**: On failure only
- **Video**: Retained on failure
- **Trace**: On first retry

## Test Data

Test users are defined in `utils/test-helpers.ts`:
- `testuser1` / `password123` / `testuser1@example.com`
- `testuser2` / `password123` / `testuser2@example.com`
- `testuser3` / `password123` / `testuser3@example.com`

## Helper Functions

The `utils/test-helpers.ts` file provides utility functions for common test operations:

- `registerUser()` - Register a new user through UI
- `loginUser()` - Login user through UI
- `addBuddy()` - Add a buddy through UI
- `sendMessage()` - Send a message in chat
- `waitForMessage()` - Wait for message to appear
- `setStatus()` - Change user status
- `setAwayMessage()` - Set away message
- `waitForSound()` - Wait for sound notification

## Test Environment

The tests automatically:
1. Start both frontend and backend servers
2. Set up a clean test database
3. Run tests in isolated browser contexts
4. Clean up test data after completion

## Debugging

For debugging failed tests:

1. Use `--debug` flag to step through tests
2. Check screenshots in `test-results/` directory
3. View video recordings of failed tests
4. Use `--headed` mode to see browser interactions
5. Check the HTML report for detailed test results

## CI/CD Integration

These tests are designed to run in CI environments with:
- Automatic server startup
- Clean database setup/teardown
- Retry logic for flaky tests
- Comprehensive reporting

## Requirements Validation

These E2E tests validate all requirements from the original specification:

- **Authentication (1.1-1.5)**: Complete registration and login flows
- **Buddy Management (2.1-2.5)**: Buddy list operations and status tracking
- **Messaging (3.1-3.5)**: Real-time messaging and offline handling
- **Status Management (4.1-4.5)**: Status changes and away messages
- **User Experience (5.1-5.5)**: Preferences and notifications
- **UI/UX (6.1-6.5)**: Classic AIM styling and interactions

## Maintenance

To maintain these tests:

1. Update test data when user schema changes
2. Adjust selectors when UI components change
3. Update timeouts if server response times change
4. Add new tests for new features
5. Keep helper functions up to date with UI changes
