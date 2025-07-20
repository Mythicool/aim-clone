import { Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserData, UpdateUserData, UserStatus } from '../models/User';

export class UserRepository {
  constructor(private db: Database) {}

  async create(userData: CreateUserData): Promise<User> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO users (
        id, screen_name, email, password_hash, display_name, created_at, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.db.run(query, [
        id,
        userData.screenName,
        userData.email,
        userData.passwordHash,
        userData.displayName || null,
        now,
        now
      ]);

      const user = await this.findById(id);
      if (!user) {
        throw new Error('Failed to create user');
      }
      return user;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('screen_name')) {
          throw new Error('Screen name already exists');
        }
        if (error.message.includes('email')) {
          throw new Error('Email already exists');
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, screen_name as screenName, email, password_hash as passwordHash,
             display_name as displayName, location, interests, away_message as awayMessage,
             status, last_seen as lastSeen, created_at as createdAt
      FROM users WHERE id = ?
    `;

    const row = await this.db.get(query, [id]);
    return row ? this.mapRowToUser(row) : null;
  }

  async findByScreenName(screenName: string): Promise<User | null> {
    const query = `
      SELECT id, screen_name as screenName, email, password_hash as passwordHash,
             display_name as displayName, location, interests, away_message as awayMessage,
             status, last_seen as lastSeen, created_at as createdAt
      FROM users WHERE screen_name = ? COLLATE NOCASE
    `;

    const row = await this.db.get(query, [screenName]);
    return row ? this.mapRowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, screen_name as screenName, email, password_hash as passwordHash,
             display_name as displayName, location, interests, away_message as awayMessage,
             status, last_seen as lastSeen, created_at as createdAt
      FROM users WHERE email = ? COLLATE NOCASE
    `;

    const row = await this.db.get(query, [email]);
    return row ? this.mapRowToUser(row) : null;
  }

  async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updateData.displayName !== undefined) {
      fields.push('display_name = ?');
      values.push(updateData.displayName);
    }
    if (updateData.location !== undefined) {
      fields.push('location = ?');
      values.push(updateData.location);
    }
    if (updateData.interests !== undefined) {
      fields.push('interests = ?');
      values.push(updateData.interests);
    }
    if (updateData.awayMessage !== undefined) {
      fields.push('away_message = ?');
      values.push(updateData.awayMessage);
    }
    if (updateData.status !== undefined) {
      fields.push('status = ?');
      values.push(updateData.status);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('last_seen = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

    await this.db.run(query, values);
    return this.findById(id);
  }

  async updateStatus(id: string, status: UserStatus): Promise<void> {
    const query = `
      UPDATE users 
      SET status = ?, last_seen = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    await this.db.run(query, [status, id]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = ?';
    const result = await this.db.run(query, [id]);
    return (result.changes || 0) > 0;
  }

  async findOnlineUsers(): Promise<User[]> {
    const query = `
      SELECT id, screen_name as screenName, email, password_hash as passwordHash,
             display_name as displayName, location, interests, away_message as awayMessage,
             status, last_seen as lastSeen, created_at as createdAt
      FROM users 
      WHERE status IN ('online', 'away') 
      ORDER BY screen_name COLLATE NOCASE
    `;

    const rows = await this.db.all(query);
    return rows.map(row => this.mapRowToUser(row));
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      screenName: row.screenName,
      email: row.email,
      passwordHash: row.passwordHash,
      displayName: row.displayName,
      location: row.location,
      interests: row.interests,
      awayMessage: row.awayMessage,
      status: row.status as UserStatus,
      lastSeen: new Date(row.lastSeen),
      createdAt: new Date(row.createdAt)
    };
  }
}