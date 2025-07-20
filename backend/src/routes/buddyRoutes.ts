import { Router, Request, Response } from 'express';
import { BuddyService } from '../services/BuddyService';
import { DatabaseService } from '../database/DatabaseService';
import { authMiddleware } from '../middleware/authMiddleware';

// Helper function to create BuddyService instance
function createBuddyService(): BuddyService {
  const dbService = DatabaseService.getInstance();
  const buddyRepository = dbService.getBuddyRelationshipRepository();
  const buddyRequestRepository = dbService.getBuddyRequestRepository();
  const userRepository = dbService.getUserRepository();
  return new BuddyService(buddyRepository, buddyRequestRepository, userRepository);
}

const router = Router();

// Apply authentication middleware to all buddy routes
router.use(authMiddleware);

// Add buddy by screen name (sends buddy request)
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { screenName, message } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    if (!screenName) {
      return res.status(400).json({ 
        error: { 
          code: 'INVALID_INPUT', 
          message: 'Screen name is required' 
        } 
      });
    }

    const buddyService = createBuddyService();

    const request = await buddyService.sendBuddyRequest(userId, screenName, message);
    res.status(201).json({ 
      message: 'Buddy request sent successfully',
      request 
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(404).json({ 
          error: { 
            code: 'USER_NOT_FOUND', 
            message: 'The specified user does not exist' 
          } 
        });
      }
      if (error.message === 'Cannot send buddy request to yourself') {
        return res.status(400).json({ 
          error: { 
            code: 'INVALID_OPERATION', 
            message: 'Cannot send buddy request to yourself' 
          } 
        });
      }
      if (error.message === 'User is already in your buddy list') {
        return res.status(409).json({ 
          error: { 
            code: 'ALREADY_BUDDIES', 
            message: 'This user is already in your buddy list' 
          } 
        });
      }
      if (error.message === 'Buddy request already sent') {
        return res.status(409).json({ 
          error: { 
            code: 'REQUEST_EXISTS', 
            message: 'Buddy request already sent to this user' 
          } 
        });
      }
      if (error.message === 'This user has already sent you a buddy request') {
        return res.status(409).json({ 
          error: { 
            code: 'REVERSE_REQUEST_EXISTS', 
            message: 'This user has already sent you a buddy request. Check your pending requests.' 
          } 
        });
      }
    }
    
    console.error('Error sending buddy request:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to send buddy request' 
      } 
    });
  }
});

// Remove buddy by ID
router.delete('/:buddyId', async (req: Request, res: Response) => {
  try {
    const { buddyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const success = await buddyService.removeBuddy(userId, buddyId);
    if (success) {
      res.status(200).json({ message: 'Buddy removed successfully' });
    } else {
      res.status(404).json({ 
        error: { 
          code: 'BUDDY_NOT_FOUND', 
          message: 'Buddy relationship not found' 
        } 
      });
    }
  } catch (error) {
    console.error('Error removing buddy:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to remove buddy' 
      } 
    });
  }
});

// Remove buddy by screen name
router.delete('/remove/:screenName', async (req: Request, res: Response) => {
  try {
    const { screenName } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const success = await buddyService.removeBuddyByScreenName(userId, screenName);
    if (success) {
      res.status(200).json({ message: 'Buddy removed successfully' });
    } else {
      res.status(404).json({ 
        error: { 
          code: 'BUDDY_NOT_FOUND', 
          message: 'Buddy relationship not found' 
        } 
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return res.status(404).json({ 
        error: { 
          code: 'USER_NOT_FOUND', 
          message: 'The specified user does not exist' 
        } 
      });
    }
    
    console.error('Error removing buddy by screen name:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to remove buddy' 
      } 
    });
  }
});

// Get buddy list with status information
router.get('/list', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const buddies = await buddyService.getBuddyList(userId);
    res.json(buddies);
  } catch (error) {
    console.error('Error getting buddy list:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to retrieve buddy list' 
      } 
    });
  }
});

// Get buddies by group
router.get('/group/:groupName', async (req: Request, res: Response) => {
  try {
    const { groupName } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const buddies = await buddyService.getBuddiesByGroup(userId, decodeURIComponent(groupName));
    res.json(buddies);
  } catch (error) {
    console.error('Error getting buddies by group:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to retrieve buddies by group' 
      } 
    });
  }
});

// Get group names
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const groups = await buddyService.getGroupNames(userId);
    res.json(groups);
  } catch (error) {
    console.error('Error getting group names:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to retrieve group names' 
      } 
    });
  }
});

// Update buddy group
router.put('/:buddyId/group', async (req: Request, res: Response) => {
  try {
    const { buddyId } = req.params;
    const { groupName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    if (!groupName) {
      return res.status(400).json({ 
        error: { 
          code: 'INVALID_INPUT', 
          message: 'Group name is required' 
        } 
      });
    }

    const buddyService = createBuddyService();

    const updatedRelationship = await buddyService.updateBuddyGroup(userId, buddyId, groupName);
    if (updatedRelationship) {
      res.json(updatedRelationship);
    } else {
      res.status(404).json({ 
        error: { 
          code: 'BUDDY_NOT_FOUND', 
          message: 'Buddy relationship not found' 
        } 
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Buddy relationship not found') {
      return res.status(404).json({ 
        error: { 
          code: 'BUDDY_NOT_FOUND', 
          message: 'Buddy relationship not found' 
        } 
      });
    }
    
    console.error('Error updating buddy group:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to update buddy group' 
      } 
    });
  }
});

// Get online buddies
router.get('/online', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const onlineBuddies = await buddyService.getOnlineBuddies(userId);
    res.json(onlineBuddies);
  } catch (error) {
    console.error('Error getting online buddies:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to retrieve online buddies' 
      } 
    });
  }
});

// Get offline buddies
router.get('/offline', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const offlineBuddies = await buddyService.getOfflineBuddies(userId);
    res.json(offlineBuddies);
  } catch (error) {
    console.error('Error getting offline buddies:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to retrieve offline buddies' 
      } 
    });
  }
});

// Check if users are buddies
router.get('/check/:buddyId', async (req: Request, res: Response) => {
  try {
    const { buddyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const areBuddies = await buddyService.areBuddies(userId, buddyId);
    res.json({ areBuddies });
  } catch (error) {
    console.error('Error checking buddy relationship:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to check buddy relationship' 
      } 
    });
  }
});

// Get buddy count
router.get('/count', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();

    const count = await buddyService.getBuddyCount(userId);
    res.json({ count });
  } catch (error) {
    console.error('Error getting buddy count:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to retrieve buddy count' 
      } 
    });
  }
});

// Buddy Request Routes

// Send buddy request
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { screenName, message } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    if (!screenName) {
      return res.status(400).json({ 
        error: { 
          code: 'INVALID_INPUT', 
          message: 'Screen name is required' 
        } 
      });
    }

    const buddyService = createBuddyService();
    const request = await buddyService.sendBuddyRequest(userId, screenName, message);
    res.status(201).json(request);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(404).json({ 
          error: { 
            code: 'USER_NOT_FOUND', 
            message: 'The specified user does not exist' 
          } 
        });
      }
      if (error.message === 'Cannot send buddy request to yourself') {
        return res.status(400).json({ 
          error: { 
            code: 'INVALID_OPERATION', 
            message: 'Cannot send buddy request to yourself' 
          } 
        });
      }
      if (error.message === 'User is already in your buddy list') {
        return res.status(409).json({ 
          error: { 
            code: 'ALREADY_BUDDIES', 
            message: 'This user is already in your buddy list' 
          } 
        });
      }
      if (error.message === 'Buddy request already sent') {
        return res.status(409).json({ 
          error: { 
            code: 'REQUEST_EXISTS', 
            message: 'Buddy request already sent to this user' 
          } 
        });
      }
      if (error.message === 'This user has already sent you a buddy request') {
        return res.status(409).json({ 
          error: { 
            code: 'REVERSE_REQUEST_EXISTS', 
            message: 'This user has already sent you a buddy request. Check your pending requests.' 
          } 
        });
      }
    }
    
    console.error('Error sending buddy request:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to send buddy request' 
      } 
    });
  }
});

// Accept buddy request
router.post('/request/:requestId/accept', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();
    const relationship = await buddyService.acceptBuddyRequest(requestId, userId);
    res.status(200).json(relationship);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Buddy request not found') {
        return res.status(404).json({ 
          error: { 
            code: 'REQUEST_NOT_FOUND', 
            message: 'Buddy request not found' 
          } 
        });
      }
      if (error.message === 'Unauthorized to accept this request') {
        return res.status(403).json({ 
          error: { 
            code: 'UNAUTHORIZED_ACTION', 
            message: 'You are not authorized to accept this request' 
          } 
        });
      }
      if (error.message === 'Buddy request is no longer pending') {
        return res.status(409).json({ 
          error: { 
            code: 'REQUEST_NOT_PENDING', 
            message: 'This buddy request is no longer pending' 
          } 
        });
      }
      if (error.message === 'Users are already buddies') {
        return res.status(409).json({ 
          error: { 
            code: 'ALREADY_BUDDIES', 
            message: 'You are already buddies with this user' 
          } 
        });
      }
    }
    
    console.error('Error accepting buddy request:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to accept buddy request' 
      } 
    });
  }
});

// Decline buddy request
router.post('/request/:requestId/decline', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();
    const success = await buddyService.declineBuddyRequest(requestId, userId);
    
    if (success) {
      res.status(200).json({ message: 'Buddy request declined' });
    } else {
      res.status(404).json({ 
        error: { 
          code: 'REQUEST_NOT_FOUND', 
          message: 'Buddy request not found' 
        } 
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Buddy request not found') {
        return res.status(404).json({ 
          error: { 
            code: 'REQUEST_NOT_FOUND', 
            message: 'Buddy request not found' 
          } 
        });
      }
      if (error.message === 'Unauthorized to decline this request') {
        return res.status(403).json({ 
          error: { 
            code: 'UNAUTHORIZED_ACTION', 
            message: 'You are not authorized to decline this request' 
          } 
        });
      }
      if (error.message === 'Buddy request is no longer pending') {
        return res.status(409).json({ 
          error: { 
            code: 'REQUEST_NOT_PENDING', 
            message: 'This buddy request is no longer pending' 
          } 
        });
      }
    }
    
    console.error('Error declining buddy request:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to decline buddy request' 
      } 
    });
  }
});

// Cancel buddy request
router.delete('/request/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();
    const success = await buddyService.cancelBuddyRequest(requestId, userId);
    
    if (success) {
      res.status(200).json({ message: 'Buddy request cancelled' });
    } else {
      res.status(404).json({ 
        error: { 
          code: 'REQUEST_NOT_FOUND', 
          message: 'Buddy request not found' 
        } 
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Buddy request not found') {
        return res.status(404).json({ 
          error: { 
            code: 'REQUEST_NOT_FOUND', 
            message: 'Buddy request not found' 
          } 
        });
      }
      if (error.message === 'Unauthorized to cancel this request') {
        return res.status(403).json({ 
          error: { 
            code: 'UNAUTHORIZED_ACTION', 
            message: 'You are not authorized to cancel this request' 
          } 
        });
      }
      if (error.message === 'Buddy request is no longer pending') {
        return res.status(409).json({ 
          error: { 
            code: 'REQUEST_NOT_PENDING', 
            message: 'This buddy request is no longer pending' 
          } 
        });
      }
    }
    
    console.error('Error cancelling buddy request:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to cancel buddy request' 
      } 
    });
  }
});

// Get pending buddy requests (received)
router.get('/requests/pending', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();
    const requests = await buddyService.getPendingBuddyRequests(userId);
    res.json(requests);
  } catch (error) {
    console.error('Error getting pending buddy requests:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to retrieve pending buddy requests' 
      } 
    });
  }
});

// Get sent buddy requests
router.get('/requests/sent', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
    }

    const buddyService = createBuddyService();
    const requests = await buddyService.getSentBuddyRequests(userId);
    res.json(requests);
  } catch (error) {
    console.error('Error getting sent buddy requests:', error);
    res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to retrieve sent buddy requests' 
      } 
    });
  }
});

export default router;