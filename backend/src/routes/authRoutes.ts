import { Router, Request, Response } from 'express';
import { AuthService, RegisterData, LoginCredentials } from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';
import { DatabaseService } from '../database/DatabaseService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware';
import { validateRegistrationData, validateLoginData } from '../utils/validation';

const router = Router();

// Initialize services
const initializeAuthService = async (): Promise<AuthService> => {
  const dbService = DatabaseService.getInstance();
  const db = await dbService.getDb();
  const userRepository = new UserRepository(db);
  return new AuthService(userRepository);
};

// Register endpoint
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const registerData: RegisterData = req.body;

    // Validate and sanitize input data
    const validation = validateRegistrationData(registerData);
    if (!validation.isValid) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validation.errors
        }
      });
      return;
    }

    // Use sanitized data
    const sanitizedData: RegisterData = {
      screenName: validation.sanitizedData.screenName,
      email: validation.sanitizedData.email,
      password: validation.sanitizedData.password
    };

    const authService = await initializeAuthService();
    const result = await authService.register(sanitizedData);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error) {
      // Handle specific validation errors
      if (error.message.includes('Screen name already exists') || 
          error.message.includes('Email already exists') ||
          error.message.includes('Screen name must be') ||
          error.message.includes('Password must be') ||
          error.message.includes('Valid email address is required') ||
          error.message.includes('Screen name can only contain')) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
        return;
      }
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed'
      }
    });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const credentials: LoginCredentials = req.body;

    // Validate and sanitize input data
    const validation = validateLoginData(credentials);
    if (!validation.isValid) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validation.errors
        }
      });
      return;
    }

    // Use sanitized data
    const sanitizedCredentials: LoginCredentials = {
      screenName: validation.sanitizedData.screenName,
      password: validation.sanitizedData.password
    };

    const authService = await initializeAuthService();
    const result = await authService.login(sanitizedCredentials);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof Error) {
      // Handle authentication errors
      if (error.message.includes('Invalid screen name or password')) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_ERROR',
            message: 'Invalid screen name or password'
          }
        });
        return;
      }
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed'
      }
    });
  }
});

// Logout endpoint (protected route)
router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const authService = await initializeAuthService();
    await authService.logout(req.user!.id);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed'
      }
    });
  }
});

// Get current user endpoint (protected route)
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const userRepository = new UserRepository(db);
    
    const user = await userRepository.findById(req.user!.id);
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    // Remove password hash from response
    const { passwordHash, ...sanitizedUser } = user;

    res.json({
      success: true,
      data: sanitizedUser
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user information'
      }
    });
  }
});

// Validate token endpoint
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Token is required'
        }
      });
      return;
    }

    const authService = await initializeAuthService();
    const user = await authService.validateToken(token);
    
    // Remove password hash from response
    const { passwordHash, ...sanitizedUser } = user;

    res.json({
      success: true,
      data: sanitizedUser
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
});

export default router;