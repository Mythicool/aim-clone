import { Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import { BuddyRelationship, CreateBuddyRelationshipData, BuddyWithStatus } from '../models/BuddyRelationship';

export class BuddyRelationshipRepository {
  constructor(private db: Database) {}

  async create(relationshipData: CreateBuddyRelationshipData): Promise<BuddyRelationship> {
    const id = uuidv4();
    const addedAt = new Date().toISOString();

    const query = `
      INSERT INTO buddy_relationships (id, user_id, buddy_id, group_name, added_at)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      await this.db.run(query, [
        id,
        relationshipData.userId,
        relationshipData.buddyId,
        relationshipData.groupName || 'Buddies',
        addedAt
      ]);

      const relationship = await this.findById(id);
      if (!relationship) {
        throw new Error('Failed to create buddy relationship');
      }
      return relationship;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Buddy relationship already exists');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<BuddyRelationship | null> {
    const query = `
      SELECT id, user_id as userId, buddy_id as buddyId, 
             group_name as groupName, added_at as addedAt
      FROM buddy_relationships WHERE id = ?
    `;

    const row = await this.db.get(query, [id]);
    return row ? this.mapRowToBuddyRelationship(row) : null;
  }

  async findByUserAndBuddy(userId: string, buddyId: string): Promise<BuddyRelationship | null> {
    const query = `
      SELECT id, user_id as userId, buddy_id as buddyId, 
             group_name as groupName, added_at as addedAt
      FROM buddy_relationships 
      WHERE user_id = ? AND buddy_id = ?
    `;

    const row = await this.db.get(query, [userId, buddyId]);
    return row ? this.mapRowToBuddyRelationship(row) : null;
  }

  async findBuddiesByUserId(userId: string): Promise<BuddyWithStatus[]> {
    const query = `
      SELECT br.id, br.user_id as userId, br.buddy_id as buddyId,
             br.group_name as groupName, br.added_at as addedAt,
             u.id as buddyUserId, u.screen_name as buddyScreenName,
             u.display_name as buddyDisplayName, u.status as buddyStatus,
             u.away_message as buddyAwayMessage, u.last_seen as buddyLastSeen
      FROM buddy_relationships br
      JOIN users u ON br.buddy_id = u.id
      WHERE br.user_id = ?
      ORDER BY br.group_name, u.screen_name COLLATE NOCASE
    `;

    const rows = await this.db.all(query, [userId]);
    return rows.map(row => ({
      id: row.id,
      userId: row.userId,
      buddyId: row.buddyId,
      groupName: row.groupName,
      addedAt: new Date(row.addedAt),
      buddy: {
        id: row.buddyUserId,
        screenName: row.buddyScreenName,
        displayName: row.buddyDisplayName,
        status: row.buddyStatus,
        awayMessage: row.buddyAwayMessage,
        lastSeen: new Date(row.buddyLastSeen)
      }
    }));
  }

  async findBuddiesByGroup(userId: string, groupName: string): Promise<BuddyWithStatus[]> {
    const query = `
      SELECT br.id, br.user_id as userId, br.buddy_id as buddyId,
             br.group_name as groupName, br.added_at as addedAt,
             u.id as buddyUserId, u.screen_name as buddyScreenName,
             u.display_name as buddyDisplayName, u.status as buddyStatus,
             u.away_message as buddyAwayMessage, u.last_seen as buddyLastSeen
      FROM buddy_relationships br
      JOIN users u ON br.buddy_id = u.id
      WHERE br.user_id = ? AND br.group_name = ?
      ORDER BY u.screen_name COLLATE NOCASE
    `;

    const rows = await this.db.all(query, [userId, groupName]);
    return rows.map(row => ({
      id: row.id,
      userId: row.userId,
      buddyId: row.buddyId,
      groupName: row.groupName,
      addedAt: new Date(row.addedAt),
      buddy: {
        id: row.buddyUserId,
        screenName: row.buddyScreenName,
        displayName: row.buddyDisplayName,
        status: row.buddyStatus,
        awayMessage: row.buddyAwayMessage,
        lastSeen: new Date(row.buddyLastSeen)
      }
    }));
  }

  async getGroupNames(userId: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT group_name as groupName
      FROM buddy_relationships
      WHERE user_id = ?
      ORDER BY group_name
    `;

    const rows = await this.db.all(query, [userId]);
    return rows.map(row => row.groupName);
  }

  async updateGroup(id: string, groupName: string): Promise<BuddyRelationship | null> {
    const query = 'UPDATE buddy_relationships SET group_name = ? WHERE id = ?';
    await this.db.run(query, [groupName, id]);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM buddy_relationships WHERE id = ?';
    const result = await this.db.run(query, [id]);
    return (result.changes || 0) > 0;
  }

  async deleteByUserAndBuddy(userId: string, buddyId: string): Promise<boolean> {
    const query = 'DELETE FROM buddy_relationships WHERE user_id = ? AND buddy_id = ?';
    const result = await this.db.run(query, [userId, buddyId]);
    return (result.changes || 0) > 0;
  }

  async areBuddies(userId: string, buddyId: string): Promise<boolean> {
    const relationship = await this.findByUserAndBuddy(userId, buddyId);
    return relationship !== null;
  }

  async getBuddyCount(userId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM buddy_relationships WHERE user_id = ?';
    const row = await this.db.get(query, [userId]);
    return row?.count || 0;
  }

  async findUsersWithBuddy(buddyId: string): Promise<BuddyRelationship[]> {
    const query = `
      SELECT id, user_id as userId, buddy_id as buddyId, 
             group_name as groupName, added_at as addedAt
      FROM buddy_relationships 
      WHERE buddy_id = ?
    `;

    const rows = await this.db.all(query, [buddyId]);
    return rows.map(row => this.mapRowToBuddyRelationship(row));
  }

  private mapRowToBuddyRelationship(row: any): BuddyRelationship {
    return {
      id: row.id,
      userId: row.userId,
      buddyId: row.buddyId,
      groupName: row.groupName,
      addedAt: new Date(row.addedAt)
    };
  }
}