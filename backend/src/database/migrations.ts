import { Database } from 'sqlite';

export async function runMigrations(db: Database): Promise<void> {
  try {
    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON;');

    // Create users table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        location TEXT,
        interests TEXT,
        away_message TEXT,
        status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'invisible', 'offline')),
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (from_user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create buddy_relationships table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS buddy_relationships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        buddy_id TEXT NOT NULL,
        group_name TEXT DEFAULT 'Buddies',
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (buddy_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, buddy_id)
      )
    `);

    // Create buddy_requests table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS buddy_requests (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(from_user_id, to_user_id)
      )
    `);

    // Create indexes for better performance
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages (from_user_id);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages (to_user_id);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_buddy_relationships_user ON buddy_relationships (user_id);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_screen_name ON users (screen_name);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_buddy_requests_from_user ON buddy_requests (from_user_id);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_buddy_requests_to_user ON buddy_requests (to_user_id);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_buddy_requests_status ON buddy_requests (status);
    `);

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error('Database migration failed');
  }
}