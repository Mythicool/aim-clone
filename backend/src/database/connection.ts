import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

export async function initializeDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  try {
    let dbPath: string;

    if (process.env.NODE_ENV === 'test') {
      dbPath = ':memory:';
    } else {
      // Use environment variable if available, otherwise fall back to appropriate defaults
      dbPath = process.env.DATABASE_URL || process.env.DB_PATH;

      if (!dbPath) {
        // For production/deployment environments, use /tmp which is typically writable
        if (process.env.NODE_ENV === 'production') {
          dbPath = '/tmp/aim.db';
        } else {
          // For development, use the local data directory
          dbPath = path.join(__dirname, '../../data/aim.db');
        }
      }

      // Ensure the directory exists (except for :memory: databases)
      if (dbPath !== ':memory:') {
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
      }
    }

    console.log(`Initializing database at: ${dbPath}`);

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('Database connection established');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error('Database initialization failed');
  }
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return await initializeDatabase();
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    console.log('Database connection closed');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});