import { Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import { Message, CreateMessageData, MessageWithUsers } from '../models/Message';

export class MessageRepository {
  constructor(private db: Database) {}

  async create(messageData: CreateMessageData): Promise<Message> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const query = `
      INSERT INTO messages (id, from_user_id, to_user_id, content, timestamp, is_read, is_delivered, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      id,
      messageData.fromUserId,
      messageData.toUserId,
      messageData.content,
      timestamp,
      false,
      false,
      null
    ]);

    const message = await this.findById(id);
    if (!message) {
      throw new Error('Failed to create message');
    }
    return message;
  }

  async findById(id: string): Promise<Message | null> {
    const query = `
      SELECT id, from_user_id as fromUserId, to_user_id as toUserId,
             content, timestamp, is_read as isRead, is_delivered as isDelivered,
             delivered_at as deliveredAt
      FROM messages WHERE id = ?
    `;

    const row = await this.db.get(query, [id]);
    return row ? this.mapRowToMessage(row) : null;
  }

  async findConversation(user1Id: string, user2Id: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    const query = `
      SELECT id, from_user_id as fromUserId, to_user_id as toUserId,
             content, timestamp, is_read as isRead, is_delivered as isDelivered,
             delivered_at as deliveredAt
      FROM messages
      WHERE (from_user_id = ? AND to_user_id = ?)
         OR (from_user_id = ? AND to_user_id = ?)
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await this.db.all(query, [user1Id, user2Id, user2Id, user1Id, limit, offset]);
    return rows.map(row => this.mapRowToMessage(row)).reverse(); // Reverse to get chronological order
  }

  async countConversationMessages(user1Id: string, user2Id: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE (from_user_id = ? AND to_user_id = ?)
         OR (from_user_id = ? AND to_user_id = ?)
    `;

    const row = await this.db.get(query, [user1Id, user2Id, user2Id, user1Id]);
    return row?.count || 0;
  }

  async findConversationWithUsers(user1Id: string, user2Id: string, limit: number = 50): Promise<MessageWithUsers[]> {
    const query = `
      SELECT m.id, m.from_user_id as fromUserId, m.to_user_id as toUserId,
             m.content, m.timestamp, m.is_read as isRead, m.is_delivered as isDelivered,
             m.delivered_at as deliveredAt,
             fu.id as fromUserId, fu.screen_name as fromScreenName,
             tu.id as toUserId, tu.screen_name as toScreenName
      FROM messages m
      JOIN users fu ON m.from_user_id = fu.id
      JOIN users tu ON m.to_user_id = tu.id
      WHERE (m.from_user_id = ? AND m.to_user_id = ?)
         OR (m.from_user_id = ? AND m.to_user_id = ?)
      ORDER BY m.timestamp DESC
      LIMIT ?
    `;

    const rows = await this.db.all(query, [user1Id, user2Id, user2Id, user1Id, limit]);
    return rows.map(row => ({
      id: row.id,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      content: row.content,
      timestamp: new Date(row.timestamp),
      isRead: Boolean(row.isRead),
      isDelivered: Boolean(row.isDelivered),
      deliveredAt: row.deliveredAt ? new Date(row.deliveredAt) : undefined,
      fromUser: {
        id: row.fromUserId,
        screenName: row.fromScreenName
      },
      toUser: {
        id: row.toUserId,
        screenName: row.toScreenName
      }
    })).reverse();
  }

  async markAsRead(messageId: string): Promise<void> {
    const query = 'UPDATE messages SET is_read = ? WHERE id = ?';
    await this.db.run(query, [true, messageId]);
  }

  async markConversationAsRead(userId: string, otherUserId: string): Promise<void> {
    const query = `
      UPDATE messages 
      SET is_read = ? 
      WHERE to_user_id = ? AND from_user_id = ? AND is_read = ?
    `;
    await this.db.run(query, [true, userId, otherUserId, false]);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE to_user_id = ? AND is_read = ?
    `;
    const row = await this.db.get(query, [userId, false]);
    return row?.count || 0;
  }

  async getUnreadCountFromUser(userId: string, fromUserId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE to_user_id = ? AND from_user_id = ? AND is_read = ?
    `;
    const row = await this.db.get(query, [userId, fromUserId, false]);
    return row?.count || 0;
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM messages WHERE id = ?';
    const result = await this.db.run(query, [id]);
    return (result.changes || 0) > 0;
  }

  async deleteConversation(user1Id: string, user2Id: string): Promise<number> {
    const query = `
      DELETE FROM messages 
      WHERE (from_user_id = ? AND to_user_id = ?) 
         OR (from_user_id = ? AND to_user_id = ?)
    `;
    const result = await this.db.run(query, [user1Id, user2Id, user2Id, user1Id]);
    return result.changes || 0;
  }

  private mapRowToMessage(row: any): Message {
    return {
      id: row.id,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      content: row.content,
      timestamp: new Date(row.timestamp),
      isRead: Boolean(row.isRead),
      isDelivered: Boolean(row.isDelivered),
      deliveredAt: row.deliveredAt ? new Date(row.deliveredAt) : undefined
    };
  }

  /**
   * Find undelivered messages for a user
   */
  async findUndeliveredMessages(userId: string): Promise<MessageWithUsers[]> {
    const query = `
      SELECT m.id, m.from_user_id as fromUserId, m.to_user_id as toUserId,
             m.content, m.timestamp, m.is_read as isRead, m.is_delivered as isDelivered,
             m.delivered_at as deliveredAt,
             fu.id as fromUserId, fu.screen_name as fromScreenName,
             tu.id as toUserId, tu.screen_name as toScreenName
      FROM messages m
      JOIN users fu ON m.from_user_id = fu.id
      JOIN users tu ON m.to_user_id = tu.id
      WHERE m.to_user_id = ? AND m.is_delivered = 0
      ORDER BY m.timestamp ASC
    `;

    const rows = await this.db.all(query, [userId]);
    return rows.map(row => ({
      id: row.id,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      content: row.content,
      timestamp: new Date(row.timestamp),
      isRead: Boolean(row.isRead),
      isDelivered: Boolean(row.isDelivered),
      deliveredAt: row.deliveredAt ? new Date(row.deliveredAt) : undefined,
      fromUser: {
        id: row.fromUserId,
        screenName: row.fromScreenName
      },
      toUser: {
        id: row.toUserId,
        screenName: row.toScreenName
      }
    }));
  }

  /**
   * Mark messages as delivered
   */
  async markAsDelivered(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    const placeholders = messageIds.map(() => '?').join(',');
    const query = `
      UPDATE messages
      SET is_delivered = 1, delivered_at = ?
      WHERE id IN (${placeholders})
    `;

    const now = new Date().toISOString();
    await this.db.run(query, [now, ...messageIds]);
  }

  /**
   * Count undelivered messages for a user
   */
  async countUndeliveredMessages(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE to_user_id = ? AND is_delivered = 0
    `;

    const row = await this.db.get(query, [userId]);
    return row?.count || 0;
  }
}