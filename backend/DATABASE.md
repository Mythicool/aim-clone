# Database Documentation

## Overview

The AIM backend uses SQLite for data persistence with the following key components:

- **Database Connection**: Managed through `DatabaseService` singleton
- **Models**: TypeScript interfaces defining data structures
- **Repositories**: Data access layer with CRUD operations
- **Migrations**: Automatic schema setup and updates

## Database Schema

### Users Table
- `id` (TEXT PRIMARY KEY) - Unique user identifier
- `screen_name` (TEXT UNIQUE) - User's AIM screen name
- `email` (TEXT UNIQUE) - User's email address
- `password_hash` (TEXT) - Hashed password
- `display_name` (TEXT) - Optional display name
- `location` (TEXT) - User's location
- `interests` (TEXT) - User's interests
- `away_message` (TEXT) - Custom away message
- `status` (TEXT) - Current status (online, away, invisible, offline)
- `last_seen` (DATETIME) - Last activity timestamp
- `created_at` (DATETIME) - Account creation timestamp

### Messages Table
- `id` (TEXT PRIMARY KEY) - Unique message identifier
- `from_user_id` (TEXT) - Sender's user ID
- `to_user_id` (TEXT) - Recipient's user ID
- `content` (TEXT) - Message content
- `timestamp` (DATETIME) - Message timestamp
- `is_read` (BOOLEAN) - Read status

### Buddy Relationships Table
- `id` (TEXT PRIMARY KEY) - Unique relationship identifier
- `user_id` (TEXT) - User who added the buddy
- `buddy_id` (TEXT) - User who was added as buddy
- `group_name` (TEXT) - Buddy list group name
- `added_at` (DATETIME) - Relationship creation timestamp

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Database**
   ```bash
   npm run setup-db
   ```

3. **Build Project**
   ```bash
   npm run build
   ```

4. **Start Server**
   ```bash
   npm start
   ```

## Development

For development with auto-reload:
```bash
npm run dev
```

## Database Operations

### User Operations
- Create user account
- Find user by ID or screen name
- Update user profile and status
- Delete user account
- List online users

### Message Operations
- Send message between users
- Retrieve conversation history
- Mark messages as read
- Get unread message counts
- Delete messages

### Buddy Operations
- Add/remove buddy relationships
- Organize buddies into groups
- Retrieve buddy lists with status
- Check buddy relationship status

## Error Handling

The database layer includes comprehensive error handling for:
- Connection failures
- Constraint violations (unique screen names, emails)
- Foreign key violations
- Transaction rollbacks
- Graceful shutdown procedures

## Performance Considerations

- Indexes on frequently queried columns
- Efficient conversation queries
- Connection pooling and reuse
- Prepared statements for security
- Pagination support for large datasets