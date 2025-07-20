import { Router, Request, Response } from 'express';
import { UserService, UserProfileUpdate } from '../services/UserService';
import { UserRepository } from '../repositories/UserRepository';
import { DatabaseService } from '../database/DatabaseService';
import { authMiddleware } from '../middleware/authMiddleware';
import { UserStatus } from '../models/User';

const router = Router();

// Helper function to get UserService instance
const getUserService = (): UserService => {
  const dbService = DatabaseService.getInstance();
  const userRepository = dbService.getUserRepository();
  return new UserService(userRepository);
};

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get current user profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const userService = getUserService();
    const profile = await userService.getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to get user profile' 
      } 
    });
  }
});

// Update user profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const profileData: UserProfileUpdate = req.body;
    const userService = getUserService();
    const updatedUser = await userService.updateProfile(userId, profileData);
    
    if (!updatedUser) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const sanitizedUser = userService.sanitizeUser(updatedUser);
    res.json({ user: sanitizedUser });
  } catch (error) {
    console.error('Error updating user profile:', error);
    
    if (error instanceof Error) {
      // Handle validation errors
      if (error.message.includes('cannot exceed') || error.message.includes('required')) {
        return res.status(400).json({ 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: error.message 
          } 
        });
      }
    }

    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to update user profile' 
      } 
    });
  }
});

// Handle empty search parameter
router.get('/search/', async (req: Request, res: Response) => {
  return res.status(400).json({ 
    error: { 
      code: 'INVALID_INPUT', 
      message: 'Screen name is required' 
    } 
  });
});

// Get user by screen name (for buddy search)
router.get('/search/:screenName', async (req: Request, res: Response) => {
  try {
    const { screenName } = req.params;
    
    if (!screenName || screenName.trim().length === 0) {
      return res.status(400).json({ 
        error: { 
          code: 'INVALID_INPUT', 
          message: 'Screen name is required' 
        } 
      });
    }

    const userService = getUserService();
    const user = await userService.getUserByScreenName(screenName.trim());
    
    if (!user) {
      return res.status(404).json({ 
        error: { 
          code: 'USER_NOT_FOUND', 
          message: 'User not found' 
        } 
      });
    }

    const sanitizedUser = userService.sanitizeUser(user);
    res.json({ user: sanitizedUser });
  } catch (error) {
    console.error('Error searching for user:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to search for user' 
      } 
    });
  }
});

// Update user status
router.put('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const { status, awayMessage } = req.body;
    
    // Validate status
    if (!status || !Object.values(UserStatus).includes(status)) {
      return res.status(400).json({ 
        error: { 
          code: 'INVALID_STATUS', 
          message: 'Invalid status. Must be one of: online, away, invisible, offline' 
        } 
      });
    }

    const userService = getUserService();
    const updatedUser = await userService.updateUserStatus(userId, status, awayMessage);
    
    if (!updatedUser) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const sanitizedUser = userService.sanitizeUser(updatedUser);
    res.json({ user: sanitizedUser });
  } catch (error) {
    console.error('Error updating user status:', error);
    
    if (error instanceof Error && error.message.includes('cannot exceed')) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: error.message 
        } 
      });
    }
    
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to update user status' 
      } 
    });
  }
});

// Set away message
router.put('/away-message', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const { message } = req.body;
    
    if (typeof message !== 'string') {
      return res.status(400).json({ 
        error: { 
          code: 'INVALID_INPUT', 
          message: 'Away message must be a string' 
        } 
      });
    }

    const userService = getUserService();
    const updatedUser = await userService.setAwayMessage(userId, message);
    
    if (!updatedUser) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const sanitizedUser = userService.sanitizeUser(updatedUser);
    res.json({ user: sanitizedUser });
  } catch (error) {
    console.error('Error setting away message:', error);
    
    if (error instanceof Error && error.message.includes('cannot exceed')) {
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: error.message 
        } 
      });
    }

    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to set away message' 
      } 
    });
  }
});

// Clear away message
router.delete('/away-message', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const userService = getUserService();
    const updatedUser = await userService.clearAwayMessage(userId);
    
    if (!updatedUser) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const sanitizedUser = userService.sanitizeUser(updatedUser);
    res.json({ user: sanitizedUser });
  } catch (error) {
    console.error('Error clearing away message:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to clear away message' 
      } 
    });
  }
});

// Get online users
router.get('/online', async (req: Request, res: Response) => {
  try {
    const userService = getUserService();
    const users = await userService.getOnlineUsers();
    const sanitizedUsers = users.map(user => userService.sanitizeUser(user));
    
    res.json({ users: sanitizedUsers });
  } catch (error) {
    console.error('Error getting online users:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to get online users' 
      } 
    });
  }
});

export default router;