import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { DatabaseService } from '../database/DatabaseService';

export interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    screenName: string;
    email: string;
  };
}

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    // Get token from handshake auth
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'aim-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };

    // Get user from database
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const userRepository = new UserRepository(db);
    
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      return next(new Error('Invalid token - user not found'));
    }

    // Add user info to socket
    (socket as AuthenticatedSocket).user = {
      id: user.id,
      screenName: user.screenName,
      email: user.email
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid authentication token'));
    }
    
    console.error('Socket auth middleware error:', error);
    next(new Error('Authentication failed'));
  }
};