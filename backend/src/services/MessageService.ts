import { Database } from 'sqlite';
import { MessageRepository } from '../repositories/MessageRepository';
import { Message, CreateMessageData, MessageWithUsers } from '../models/Message';
import { ConnectionManager } from './ConnectionManager';

export class MessageService {
  private messageRepository: MessageRepository;
  private connectionManager: ConnectionManager;

  constructor(db: Database) {
    this.messageRepository = new MessageRepository(db);
    this.connectionManager = ConnectionManager.getInstance();
  }

  /**
   * Send a message from one user to another
   * @param messageData Message data containing sender, recipient and content
   * @returns The created message
   */
  async sendMessage(messageData: CreateMessageData): Promise<Message> {
    // Validate message content
    if (!messageData.content || messageData.content.trim() === '') {
      throw new Error('Message content cannot be empty');
    }

    // Create the message in the database
    const message = await this.messageRepository.create(messageData);
    
    return message;
  }

  /**
   * Get conversation history between two users
   * @param user1Id First user ID
   * @param user2Id Second user ID
   * @param limit Maximum number of messages to retrieve
   * @param offset Offset for pagination
   * @returns Array of messages in chronological order
   */
  async getConversation(user1Id: string, user2Id: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return this.messageRepository.findConversation(user1Id, user2Id, limit, offset);
  }

  /**
   * Get total count of messages in a conversation
   * @param user1Id First user ID
   * @param user2Id Second user ID
   * @returns Total number of messages in the conversation
   */
  async getConversationCount(user1Id: string, user2Id: string): Promise<number> {
    return this.messageRepository.countConversationMessages(user1Id, user2Id);
  }

  /**
   * Get conversation history with user details
   * @param user1Id First user ID
   * @param user2Id Second user ID
   * @param limit Maximum number of messages to retrieve
   * @returns Array of messages with user details in chronological order
   */
  async getConversationWithUsers(user1Id: string, user2Id: string, limit: number = 50): Promise<MessageWithUsers[]> {
    return this.messageRepository.findConversationWithUsers(user1Id, user2Id, limit);
  }

  /**
   * Mark a specific message as read
   * @param messageId ID of the message to mark as read
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    await this.messageRepository.markAsRead(messageId);
  }

  /**
   * Mark all messages in a conversation as read
   * @param userId ID of the user marking messages as read
   * @param otherUserId ID of the other user in the conversation
   */
  async markConversationAsRead(userId: string, otherUserId: string): Promise<void> {
    await this.messageRepository.markConversationAsRead(userId, otherUserId);
  }

  /**
   * Get undelivered messages for a user (messages sent while they were offline)
   * @param userId ID of the user to get undelivered messages for
   * @returns Array of undelivered messages
   */
  async getUndeliveredMessages(userId: string): Promise<MessageWithUsers[]> {
    return this.messageRepository.findUndeliveredMessages(userId);
  }

  /**
   * Mark messages as delivered to a user
   * @param userId ID of the user who received the messages
   * @param messageIds Array of message IDs to mark as delivered
   */
  async markMessagesAsDelivered(userId: string, messageIds: string[]): Promise<void> {
    await this.messageRepository.markAsDelivered(messageIds);
  }

  /**
   * Get offline message count for a user
   * @param userId ID of the user
   * @returns Number of undelivered messages
   */
  async getOfflineMessageCount(userId: string): Promise<number> {
    return this.messageRepository.countUndeliveredMessages(userId);
  }

  /**
   * Get count of unread messages for a user
   * @param userId User ID
   * @returns Number of unread messages
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.messageRepository.getUnreadCount(userId);
  }

  /**
   * Get count of unread messages from a specific user
   * @param userId User ID
   * @param fromUserId ID of the sender
   * @returns Number of unread messages from the specified sender
   */
  async getUnreadCountFromUser(userId: string, fromUserId: string): Promise<number> {
    return this.messageRepository.getUnreadCountFromUser(userId, fromUserId);
  }

  /**
   * Delete a specific message
   * @param messageId ID of the message to delete
   * @returns True if message was deleted, false otherwise
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    return this.messageRepository.delete(messageId);
  }

  /**
   * Delete entire conversation between two users
   * @param user1Id First user ID
   * @param user2Id Second user ID
   * @returns Number of messages deleted
   */
  async deleteConversation(user1Id: string, user2Id: string): Promise<number> {
    return this.messageRepository.deleteConversation(user1Id, user2Id);
  }
}