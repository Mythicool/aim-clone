import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/socketAuthMiddleware';
import { ConnectionManager } from './ConnectionManager';
import { UserRepository } from '../repositories/UserRepository';
import { BuddyRelationshipRepository } from '../repositories/BuddyRelationshipRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { DatabaseService } from '../database/DatabaseService';
import { UserStatus } from '../models/User';
import { CreateMessageData } from '../models/Message';
import { MessageService } from './MessageService';
import { UserService } from './UserService';

export class SocketEventHandlers {
  private connectionManager: ConnectionManager;
  private io: Server;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private readonly IDLE_TIMEOUT_MINUTES = 10;

  constructor(io: Server) {
    this.io = io;
    this.connectionManager = ConnectionManager.getInstance(io);
    this.startIdleDetection();
  }

  public setupEventHandlers(socket: AuthenticatedSocket): void {
    // Handle user connection
    this.handleConnection(socket);

    // Handle user disconnect
    socket.on('disconnect', () => this.handleDisconnect(socket));

    // Handle status changes
    socket.on('user:status-change', (data) => this.handleStatusChange(socket, data));

    // Handle messaging events
    socket.on('message:send', (data) => this.handleSendMessage(socket, data));
    socket.on('message:read', (data) => this.handleMarkMessageRead(socket, data));
    socket.on('conversation:typing', (data) => this.handleTypingIndicator(socket, data));

    // Handle heartbeat for connection health
    socket.on('heartbeat', () => this.handleHeartbeat(socket));

    // Handle errors
    socket.on('error', (error) => this.handleError(socket, error));
  }

  public async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      // Add connection to manager
      await this.connectionManager.addConnection(socket);

      // Get online users to send to the newly connected user
      const onlineUsers = this.connectionManager.getOnlineUsers();

      // Send connection established event to the user
      socket.emit('connection:established', {
        userId: socket.user.id,
        onlineUsers: onlineUsers.filter(userId => userId !== socket.user.id)
      });

      // Deliver offline messages
      await this.deliverOfflineMessages(socket);

      // Notify buddies that this user came online
      await this.notifyBuddiesOfStatusChange(socket.user.id, {
        userId: socket.user.id,
        screenName: socket.user.screenName,
        status: UserStatus.ONLINE
      }, 'buddy:online');

      console.log(`User ${socket.user.screenName} (${socket.user.id}) connected successfully`);
    } catch (error) {
      console.error('Error handling connection:', error);
      socket.emit('error', {
        code: 'CONNECTION_ERROR',
        message: 'Failed to establish connection'
      });
    }
  }

  public async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    try {
      // Check if user will be completely offline after this disconnect
      const wasOnline = this.connectionManager.isUserOnline(socket.user.id);
      
      // Remove connection from manager
      await this.connectionManager.removeConnection(socket.id);

      // If user is now completely offline, notify buddies
      if (wasOnline && !this.connectionManager.isUserOnline(socket.user.id)) {
        await this.notifyBuddiesOfStatusChange(socket.user.id, {
          userId: socket.user.id,
          screenName: socket.user.screenName
        }, 'buddy:offline');
      }

      console.log(`User ${socket.user.screenName} (${socket.user.id}) disconnected`);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  public async handleStatusChange(
    socket: AuthenticatedSocket, 
    data: { status: UserStatus; awayMessage?: string }
  ): Promise<void> {
    try {
      const { status, awayMessage } = data;

      // Validate status
      if (!Object.values(UserStatus).includes(status)) {
        socket.emit('error', {
          code: 'INVALID_STATUS',
          message: 'Invalid status value'
        });
        return;
      }

      // Update user status in database
      const dbService = DatabaseService.getInstance();
      const db = await dbService.getDb();
      const userRepository = new UserRepository(db);
      const userService = new UserService(userRepository);

      // Update status and away message
      const updatedUser = await userService.updateUserStatus(socket.user.id, status, awayMessage);
      if (!updatedUser) {
        socket.emit('error', {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        });
        return;
      }

      // Update connection manager with new status
      this.connectionManager.updateUserStatus(socket.user.id, status);

      // Reset user activity time to prevent immediate auto-away
      if (status === UserStatus.ONLINE) {
        this.connectionManager.updateActivity(socket.id);
      }

      // Notify buddies about status change
      await this.notifyBuddiesOfStatusChange(socket.user.id, {
        userId: socket.user.id,
        screenName: socket.user.screenName,
        status,
        awayMessage: updatedUser.awayMessage
      }, 'buddy:status-change');

      console.log(`User ${socket.user.screenName} changed status to ${status}${
        status === UserStatus.AWAY && updatedUser.awayMessage 
          ? ` with message: "${updatedUser.awayMessage}"` 
          : ''
      }`);
    } catch (error) {
      console.error('Error handling status change:', error);
      
      if (error instanceof Error && error.message.includes('cannot exceed')) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: error.message
        });
        return;
      }
      
      socket.emit('error', {
        code: 'STATUS_CHANGE_ERROR',
        message: 'Failed to update status'
      });
    }
  }

  private handleHeartbeat(socket: AuthenticatedSocket): void {
    // Update last activity
    this.connectionManager.updateActivity(socket.id);
    
    // Send heartbeat response
    socket.emit('heartbeat');
  }

  private handleError(socket: AuthenticatedSocket, error: any): void {
    console.error(`Socket error for user ${socket.user.screenName}:`, error);
  }

  // Utility method to broadcast to all users
  public broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Utility method to send to specific user
  public sendToUser(userId: string, event: string, data: any): boolean {
    return this.connectionManager.emitToUser(userId, event, data);
  }

  // Start idle detection for automatic away status
  private startIdleDetection(): void {
    // Check for idle users every minute
    this.idleCheckInterval = setInterval(async () => {
      await this.checkForIdleUsers();
    }, 60 * 1000); // Check every minute
  }

  // Stop idle detection
  public stopIdleDetection(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  // Check for users who have been idle and set them to away
  private async checkForIdleUsers(): Promise<void> {
    try {
      const connections = this.connectionManager.getAllConnections();
      const idleThreshold = new Date(Date.now() - this.IDLE_TIMEOUT_MINUTES * 60 * 1000);

      for (const connection of connections) {
        // Skip if user is already away, invisible, or offline
        if (connection.status === UserStatus.AWAY || 
            connection.status === UserStatus.INVISIBLE || 
            connection.status === UserStatus.OFFLINE) {
          continue;
        }

        // Check if user has been idle
        if (connection.lastActivity < idleThreshold) {
          await this.setUserAway(connection.userId, 'Auto-away: Idle for ' + this.IDLE_TIMEOUT_MINUTES + ' minutes');
        }
      }
    } catch (error) {
      console.error('Error checking for idle users:', error);
    }
  }

  // Set a user to away status
  private async setUserAway(userId: string, awayMessage: string): Promise<void> {
    try {
      // Update user status in database
      const dbService = DatabaseService.getInstance();
      const db = await dbService.getDb();
      const userRepository = new UserRepository(db);
      const userService = new UserService(userRepository);

      // Get current user to check if they already have a custom away message
      const currentUser = await userRepository.findById(userId);
      if (!currentUser) return;
      
      // Don't override existing away message if user is already away
      if (currentUser.status === UserStatus.AWAY && currentUser.awayMessage) {
        return;
      }

      // Update user status and away message
      const updatedUser = await userService.updateUserStatus(userId, UserStatus.AWAY, awayMessage);
      if (!updatedUser) return;

      // Update connection manager
      this.connectionManager.updateUserStatus(userId, UserStatus.AWAY);

      // Notify buddies about status change
      await this.notifyBuddiesOfStatusChange(userId, {
        userId,
        screenName: updatedUser.screenName,
        status: UserStatus.AWAY,
        awayMessage: updatedUser.awayMessage
      }, 'buddy:status-change');

      console.log(`User ${updatedUser.screenName} automatically set to away due to inactivity`);
    } catch (error) {
      console.error('Error setting user to away:', error);
    }
  }

  // Notify only buddies of a user's status change
  private async notifyBuddiesOfStatusChange(
    userId: string, 
    statusData: any, 
    eventName: string
  ): Promise<void> {
    try {
      const dbService = DatabaseService.getInstance();
      const db = await dbService.getDb();
      const buddyRepository = new BuddyRelationshipRepository(db);

      // Get all users who have this user as a buddy
      const buddyRelationships = await buddyRepository.findUsersWithBuddy(userId);

      // Notify each buddy who is online
      for (const relationship of buddyRelationships) {
        const buddyUserId = relationship.userId;
        
        // Only notify if the buddy is online
        if (this.connectionManager.isUserOnline(buddyUserId)) {
          this.connectionManager.emitToUser(buddyUserId, eventName, statusData);
        }
      }
    } catch (error) {
      console.error('Error notifying buddies of status change:', error);
    }
  }

  /**
   * Handle sending a message from one user to another
   */
  public async handleSendMessage(
    socket: AuthenticatedSocket,
    data: { toUserId: string; content: string }
  ): Promise<void> {
    try {
      const { toUserId, content } = data;
      
      // Validate message data
      if (!toUserId || !content || content.trim() === '') {
        socket.emit('error', {
          code: 'INVALID_MESSAGE',
          message: 'Invalid message data'
        });
        return;
      }

      // Create message data
      const messageData: CreateMessageData = {
        fromUserId: socket.user.id,
        toUserId,
        content
      };

      // Get database and message service
      const dbService = DatabaseService.getInstance();
      const db = await dbService.getDb();
      const messageService = new MessageService(db);
      const userRepository = new UserRepository(db);
      
      // Save message to database
      const message = await messageService.sendMessage(messageData);
      
      // Send message to sender for confirmation
      socket.emit('message:sent', { message });
      
      // Check if recipient is online
      const isRecipientOnline = this.connectionManager.isUserOnline(toUserId);

      // Get recipient user to check status and away message
      const recipientUser = await userRepository.findById(toUserId);

      let messageDelivered = false;
      
      if (isRecipientOnline) {
        // Send message to recipient in real-time
        const delivered = this.connectionManager.emitToUser(toUserId, 'message:receive', {
          message,
          from: {
            id: socket.user.id,
            screenName: socket.user.screenName
          }
        });

        if (delivered) {
          // Mark message as delivered
          await messageService.markMessagesAsDelivered(toUserId, [message.id]);
          messageDelivered = true;
        }
        
        // If recipient is away, send away message back to sender
        if (recipientUser && recipientUser.status === UserStatus.AWAY && recipientUser.awayMessage) {
          // Create system message with away message
          const awayMessageResponse: CreateMessageData = {
            fromUserId: toUserId,
            toUserId: socket.user.id,
            content: `[AUTO-RESPONSE] ${recipientUser.awayMessage}`
          };
          
          // Save away message response to database
          const awayMessage = await messageService.sendMessage(awayMessageResponse);
          
          // Send away message to sender
          socket.emit('message:receive', {
            message: awayMessage,
            from: {
              id: toUserId,
              screenName: recipientUser.screenName
            },
            isAutoResponse: true
          });
        }
      } else if (recipientUser) {
        // If recipient is offline, send a notification to the sender
        socket.emit('user:offline', {
          userId: toUserId,
          screenName: recipientUser.screenName,
          awayMessage: recipientUser.awayMessage
        });
        
        // If recipient has an away message, send it back to sender
        if (recipientUser.awayMessage) {
          // Create system message with away message
          const awayMessageResponse: CreateMessageData = {
            fromUserId: toUserId,
            toUserId: socket.user.id,
            content: `[AUTO-RESPONSE] ${recipientUser.awayMessage}`
          };
          
          // Save away message response to database
          const awayMessage = await messageService.sendMessage(awayMessageResponse);
          
          // Send away message to sender
          socket.emit('message:receive', {
            message: awayMessage,
            from: {
              id: toUserId,
              screenName: recipientUser.screenName
            },
            isAutoResponse: true
          });
        }
      }

      // Send delivery status back to sender
      socket.emit('message:delivery-status', {
        messageId: message.id,
        delivered: messageDelivered,
        recipientOnline: isRecipientOnline
      });

      console.log(`Message sent from ${socket.user.screenName} to user ${toUserId}`);
    } catch (error) {
      console.error('Error handling send message:', error);
      socket.emit('error', {
        code: 'MESSAGE_SEND_ERROR',
        message: 'Failed to send message'
      });
    }
  }

  /**
   * Handle marking messages as read
   */
  public async handleMarkMessageRead(
    socket: AuthenticatedSocket,
    data: { fromUserId: string }
  ): Promise<void> {
    try {
      const { fromUserId } = data;
      
      if (!fromUserId) {
        socket.emit('error', {
          code: 'INVALID_REQUEST',
          message: 'Invalid request data'
        });
        return;
      }

      // Get database and message service
      const dbService = DatabaseService.getInstance();
      const db = await dbService.getDb();
      const messageService = new MessageService(db);
      
      // Mark conversation as read
      await messageService.markConversationAsRead(socket.user.id, fromUserId);
      
      // Notify the sender that their messages were read
      if (this.connectionManager.isUserOnline(fromUserId)) {
        this.connectionManager.emitToUser(fromUserId, 'message:read', {
          byUserId: socket.user.id,
          byScreenName: socket.user.screenName
        });
      }
      
      console.log(`Messages from ${fromUserId} marked as read by ${socket.user.screenName}`);
    } catch (error) {
      console.error('Error marking messages as read:', error);
      socket.emit('error', {
        code: 'MESSAGE_READ_ERROR',
        message: 'Failed to mark messages as read'
      });
    }
  }

  /**
   * Handle typing indicator events
   */
  public handleTypingIndicator(
    socket: AuthenticatedSocket,
    data: { toUserId: string; isTyping: boolean }
  ): void {
    try {
      const { toUserId, isTyping } = data;
      
      if (!toUserId) {
        return;
      }
      
      // Check if recipient is online
      if (this.connectionManager.isUserOnline(toUserId)) {
        // Send typing indicator to recipient
        this.connectionManager.emitToUser(toUserId, 'conversation:typing', {
          userId: socket.user.id,
          screenName: socket.user.screenName,
          isTyping
        });
      }
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  }

  /**
   * Deliver offline messages to a user when they come online
   */
  private async deliverOfflineMessages(socket: AuthenticatedSocket): Promise<void> {
    try {
      const dbService = DatabaseService.getInstance();
      const db = await dbService.getDb();
      const messageService = new MessageService(db);

      // Get undelivered messages for this user
      const undeliveredMessages = await messageService.getUndeliveredMessages(socket.user.id);

      if (undeliveredMessages.length > 0) {
        console.log(`Delivering ${undeliveredMessages.length} offline messages to ${socket.user.screenName}`);

        // Send each message to the user
        for (const messageWithUsers of undeliveredMessages) {
          socket.emit('message:receive', {
            message: messageWithUsers,
            from: {
              id: messageWithUsers.fromUser.id,
              screenName: messageWithUsers.fromUser.screenName
            },
            isOfflineMessage: true
          });
        }

        // Mark all messages as delivered
        const messageIds = undeliveredMessages.map(msg => msg.id);
        await messageService.markMessagesAsDelivered(socket.user.id, messageIds);

        // Send notification about offline messages
        socket.emit('offline-messages:delivered', {
          count: undeliveredMessages.length,
          messages: undeliveredMessages
        });
      }
    } catch (error) {
      console.error('Error delivering offline messages:', error);
    }
  }

  // Clean up resources
  public cleanup(): void {
    this.stopIdleDetection();
  }
}