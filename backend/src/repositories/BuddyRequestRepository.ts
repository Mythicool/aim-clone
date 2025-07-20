import { Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import { BuddyRequest, CreateBuddyRequestData, BuddyRequestStatus, BuddyRequestWithUsers } from '../models/BuddyRequest';

export class BuddyRequestRepository {
  constructor(private db: Database) {}

  async create(requestData: CreateBuddyRequestData): Promise<BuddyRequest> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO buddy_requests (id, from_user_id, to_user_id, message, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.db.run(query, [
        id,
        requestData.fromUserId,
        requestData.toUserId,
        requestData.message || null,
        BuddyRequestStatus.PENDING,
        now,
        now
      ]);

      const request = await this.findById(id);
      if (!request) {
        throw new Error('Failed to create buddy request');
      }
      return request;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Buddy request already exists');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<BuddyRequest | null> {
    const query = `
      SELECT id, from_user_id as fromUserId, to_user_id as toUserId,
             message, status, created_at as createdAt, updated_at as updatedAt
      FROM buddy_requests WHERE id = ?
    `;

    const row = await this.db.get(query, [id]);
    return row ? this.mapRowToBuddyRequest(row) : null;
  }

  async findByUsers(fromUserId: string, toUserId: string): Promise<BuddyRequest | null> {
    const query = `
      SELECT id, from_user_id as fromUserId, to_user_id as toUserId,
             message, status, created_at as createdAt, updated_at as updatedAt
      FROM buddy_requests 
      WHERE from_user_id = ? AND to_user_id = ?
    `;

    const row = await this.db.get(query, [fromUserId, toUserId]);
    return row ? this.mapRowToBuddyRequest(row) : null;
  }

  async findPendingRequestsForUser(userId: string): Promise<BuddyRequestWithUsers[]> {
    const query = `
      SELECT br.id, br.from_user_id as fromUserId, br.to_user_id as toUserId,
             br.message, br.status, br.created_at as createdAt, br.updated_at as updatedAt,
             fu.id as fromUserUserId, fu.screen_name as fromUserScreenName, fu.display_name as fromUserDisplayName,
             tu.id as toUserUserId, tu.screen_name as toUserScreenName, tu.display_name as toUserDisplayName
      FROM buddy_requests br
      JOIN users fu ON br.from_user_id = fu.id
      JOIN users tu ON br.to_user_id = tu.id
      WHERE br.to_user_id = ? AND br.status = 'pending'
      ORDER BY br.created_at DESC
    `;

    const rows = await this.db.all(query, [userId]);
    return rows.map(row => ({
      id: row.id,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      fromUser: {
        id: row.fromUserUserId,
        screenName: row.fromUserScreenName,
        displayName: row.fromUserDisplayName
      },
      toUser: {
        id: row.toUserUserId,
        screenName: row.toUserScreenName,
        displayName: row.toUserDisplayName
      }
    }));
  }

  async findSentRequestsForUser(userId: string): Promise<BuddyRequestWithUsers[]> {
    const query = `
      SELECT br.id, br.from_user_id as fromUserId, br.to_user_id as toUserId,
             br.message, br.status, br.created_at as createdAt, br.updated_at as updatedAt,
             fu.id as fromUserUserId, fu.screen_name as fromUserScreenName, fu.display_name as fromUserDisplayName,
             tu.id as toUserUserId, tu.screen_name as toUserScreenName, tu.display_name as toUserDisplayName
      FROM buddy_requests br
      JOIN users fu ON br.from_user_id = fu.id
      JOIN users tu ON br.to_user_id = tu.id
      WHERE br.from_user_id = ? AND br.status = 'pending'
      ORDER BY br.created_at DESC
    `;

    const rows = await this.db.all(query, [userId]);
    return rows.map(row => ({
      id: row.id,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      fromUser: {
        id: row.fromUserUserId,
        screenName: row.fromUserScreenName,
        displayName: row.fromUserDisplayName
      },
      toUser: {
        id: row.toUserUserId,
        screenName: row.toUserScreenName,
        displayName: row.toUserDisplayName
      }
    }));
  }

  async updateStatus(id: string, status: BuddyRequestStatus): Promise<BuddyRequest | null> {
    const now = new Date().toISOString();
    const query = 'UPDATE buddy_requests SET status = ?, updated_at = ? WHERE id = ?';
    await this.db.run(query, [status, now, id]);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM buddy_requests WHERE id = ?';
    const result = await this.db.run(query, [id]);
    return (result.changes || 0) > 0;
  }

  async deleteByUsers(fromUserId: string, toUserId: string): Promise<boolean> {
    const query = 'DELETE FROM buddy_requests WHERE from_user_id = ? AND to_user_id = ?';
    const result = await this.db.run(query, [fromUserId, toUserId]);
    return (result.changes || 0) > 0;
  }

  private mapRowToBuddyRequest(row: any): BuddyRequest {
    return {
      id: row.id,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}