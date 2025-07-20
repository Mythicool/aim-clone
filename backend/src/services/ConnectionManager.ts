import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../middleware/socketAuthMiddleware';
import { UserRepository } from '../repositories/UserRepository';
import { DatabaseService } from '../database/DatabaseService';
import { UserStatus } from '../models/User';

export interface UserConnection {
  userId: string;
  screenName: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  status: UserStatus;
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  private connections: Map<string, UserConnection> = new Map(); // socketId -> UserConnection
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private io: Server;

  private constructor(io: Server) {
    this.io = io;
  }

  public static getInstance(io?: Server): ConnectionManager {
    if (!ConnectionManager.instance) {
      if (!io) {
        throw new Error('Socket.io server instance required for first initialization');
      }
      ConnectionManager.instance = new ConnectionManager(io);
    }
    return ConnectionManager.instance;
  }

  public async addConnection(socket: AuthenticatedSocket): Promise<void> {
    const connection: UserConnection = {
      userId: socket.user.id,
      screenName: socket.user.screenName,
      socketId: socket.id,
      connectedAt: new Date(),
      lastActivity: new Date(),
      status: UserStatus.ONLINE
    };

    // Add to connections map
    this.connections.set(socket.id, connection);

    // Add to user sockets map
    if (!this.userSockets.has(socket.user.id)) {
      this.userSockets.set(socket.user.id, new Set());
    }
    this.userSockets.get(socket.user.id)!.add(socket.id);

    // Update user status to online in database
    await this.updateUserStatusInDb(socket.user.id, UserStatus.ONLINE);

    console.log(`User ${socket.user.screenName} connected with socket ${socket.id}`);
  }

  public async removeConnection(socketId: string): Promise<void> {
    const connection = this.connections.get(socketId);
    if (!connection) {
      return;
    }

    // Remove from connections map
    this.connections.delete(socketId);

    // Remove from user sockets map
    const userSockets = this.userSockets.get(connection.userId);
    if (userSockets) {
      userSockets.delete(socketId);
      
      // If user has no more connections, set status to offline
      if (userSockets.size === 0) {
        this.userSockets.delete(connection.userId);
        await this.updateUserStatusInDb(connection.userId, UserStatus.OFFLINE);
      }
    }

    console.log(`User ${connection.screenName} disconnected from socket ${socketId}`);
  }

  public updateActivity(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  public updateUserStatus(userId: string, status: UserStatus): void {
    // Update status for all connections of this user
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach(socketId => {
        const connection = this.connections.get(socketId);
        if (connection) {
          connection.status = status;
        }
      });
    }
  }

  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  public getUserConnection(userId: string): UserConnection | null {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) {
      return null;
    }

    // Return the most recent connection
    const socketId = Array.from(socketIds)[0];
    return this.connections.get(socketId) || null;
  }

  public getAllConnections(): UserConnection[] {
    return Array.from(this.connections.values());
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  public emitToUser(userId: string, event: string, data: any): boolean {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) {
      return false;
    }

    // Emit to all user's sockets
    socketIds.forEach(socketId => {
      this.io.to(socketId).emit(event, data);
    });

    return true;
  }

  public emitToAllUsers(event: string, data: any): void {
    this.io.emit(event, data);
  }

  private async updateUserStatusInDb(userId: string, status: UserStatus): Promise<void> {
    try {
      const dbService = DatabaseService.getInstance();
      const db = await dbService.getDb();
      const userRepository = new UserRepository(db);
      
      await userRepository.updateStatus(userId, status);
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  }

  // Clean up inactive connections (for future use with heartbeat)
  public cleanupInactiveConnections(timeoutMinutes: number = 30): void {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    
    for (const [socketId, connection] of this.connections.entries()) {
      if (connection.lastActivity < cutoffTime) {
        // Force disconnect inactive socket
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
  }
}