import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { DatabaseService } from '../database/DatabaseService';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        screenName: string;
        email: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    screenName: string;
    email: string;
  };
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token is required'
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'aim-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };

    // Get user from database
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const userRepository = new UserRepository(db);
    
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token - user not found'
        }
      });
      return;
    }

    // Add user info to request object
    req.user = {
      id: user.id,
      screenName: user.screenName,
      email: user.email
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token'
        }
      });
      return;
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

// Optional middleware - doesn't fail if no token provided
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'aim-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };

    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const userRepository = new UserRepository(db);
    
    const user = await userRepository.findById(decoded.userId);
    if (user) {
      req.user = {
        id: user.id,
        screenName: user.screenName,
        email: user.email
      };
    }

    next();
  } catch (error) {
    // Silently continue without authentication for optional middleware
    next();
  }
};