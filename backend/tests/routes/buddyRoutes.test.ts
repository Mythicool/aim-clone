import request from 'supertest';
import express from 'express';
import buddyRoutes from '../../src/routes/buddyRoutes';
import { BuddyService } from '../../src/services/BuddyService';
import { authMiddleware } from '../../src/middleware/authMiddleware';

// Mock the dependencies
jest.mock('../../src/services/BuddyService');
jest.mock('../../src/middleware/authMiddleware');
jest.mock('../../src/database/DatabaseService', () => ({
  DatabaseService: {
    getInstance: jest.fn(() => ({
      getBuddyRelationshipRepository: jest.fn(),
      getBuddyRequestRepository: jest.fn(),
      getUserRepository: jest.fn()
    }))
  }
}));

const app = express();
app.use(express.json());
app.use('/api/buddies', buddyRoutes);

describe('Buddy Routes', () => {
  let mockBuddyService: jest.Mocked<BuddyService>;

  const mockUser = {
    id: 'user-1',
    screenName: 'testuser',
    email: 'test@example.com'
  };

  const mockDate = new Date();
  const mockBuddyRelationship = {
    id: 'relationship-1',
    userId: 'user-1',
    buddyId: 'buddy-1',
    groupName: 'Buddies',
    addedAt: mockDate
  };

  const mockBuddyWithStatus = {
    ...mockBuddyRelationship,
    buddy: {
      id: 'buddy-1',
      screenName: 'buddyuser',
      displayName: 'Buddy User',
      status: 'online',
      awayMessage: null,
      lastSeen: mockDate
    }
  };

  beforeEach(() => {
    // Mock auth middleware to add user to request
    (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/buddies/add', () => {
    it('should successfully send a buddy request', async () => {
      const mockBuddyRequest = {
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'buddy-1',
        message: 'Hi, let\'s be buddies!',
        status: 'pending',
        createdAt: mockDate,
        updatedAt: mockDate
      };

      const mockSendBuddyRequest = jest.fn().mockResolvedValue(mockBuddyRequest);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        sendBuddyRequest: mockSendBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/add')
        .send({ screenName: 'buddyuser', message: 'Hi, let\'s be buddies!' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Buddy request sent successfully');
      expect(response.body.request).toEqual({
        ...mockBuddyRequest,
        createdAt: mockDate.toISOString(),
        updatedAt: mockDate.toISOString()
      });
      expect(mockSendBuddyRequest).toHaveBeenCalledWith('user-1', 'buddyuser', 'Hi, let\'s be buddies!');
    });

    it('should return 400 when screen name is missing', async () => {
      const response = await request(app)
        .post('/api/buddies/add')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 404 when user not found', async () => {
      const mockSendBuddyRequest = jest.fn().mockRejectedValue(new Error('User not found'));
      (BuddyService as jest.Mock).mockImplementation(() => ({
        sendBuddyRequest: mockSendBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/add')
        .send({ screenName: 'nonexistent' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 400 when trying to send request to self', async () => {
      const mockSendBuddyRequest = jest.fn().mockRejectedValue(new Error('Cannot send buddy request to yourself'));
      (BuddyService as jest.Mock).mockImplementation(() => ({
        sendBuddyRequest: mockSendBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/add')
        .send({ screenName: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_OPERATION');
    });

    it('should return 409 when users are already buddies', async () => {
      const mockSendBuddyRequest = jest.fn().mockRejectedValue(new Error('User is already in your buddy list'));
      (BuddyService as jest.Mock).mockImplementation(() => ({
        sendBuddyRequest: mockSendBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/add')
        .send({ screenName: 'buddyuser' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ALREADY_BUDDIES');
    });

    it('should return 409 when request already exists', async () => {
      const mockSendBuddyRequest = jest.fn().mockRejectedValue(new Error('Buddy request already sent'));
      (BuddyService as jest.Mock).mockImplementation(() => ({
        sendBuddyRequest: mockSendBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/add')
        .send({ screenName: 'buddyuser' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('REQUEST_EXISTS');
    });
  });

  describe('DELETE /api/buddies/:buddyId', () => {
    it('should successfully remove a buddy', async () => {
      const mockRemoveBuddy = jest.fn().mockResolvedValue(true);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        removeBuddy: mockRemoveBuddy
      }));

      const response = await request(app)
        .delete('/api/buddies/buddy-1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Buddy removed successfully');
      expect(mockRemoveBuddy).toHaveBeenCalledWith('user-1', 'buddy-1');
    });

    it('should return 404 when buddy not found', async () => {
      const mockRemoveBuddy = jest.fn().mockResolvedValue(false);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        removeBuddy: mockRemoveBuddy
      }));

      const response = await request(app)
        .delete('/api/buddies/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('BUDDY_NOT_FOUND');
    });
  });

  describe('DELETE /api/buddies/remove/:screenName', () => {
    it('should successfully remove buddy by screen name', async () => {
      const mockRemoveBuddyByScreenName = jest.fn().mockResolvedValue(true);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        removeBuddyByScreenName: mockRemoveBuddyByScreenName
      }));

      const response = await request(app)
        .delete('/api/buddies/remove/buddyuser');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Buddy removed successfully');
      expect(mockRemoveBuddyByScreenName).toHaveBeenCalledWith('user-1', 'buddyuser');
    });

    it('should return 404 when user not found', async () => {
      const mockRemoveBuddyByScreenName = jest.fn().mockRejectedValue(new Error('User not found'));
      (BuddyService as jest.Mock).mockImplementation(() => ({
        removeBuddyByScreenName: mockRemoveBuddyByScreenName
      }));

      const response = await request(app)
        .delete('/api/buddies/remove/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('GET /api/buddies/list', () => {
    it('should return buddy list', async () => {
      const mockGetBuddyList = jest.fn().mockResolvedValue([mockBuddyWithStatus]);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getBuddyList: mockGetBuddyList
      }));

      const response = await request(app)
        .get('/api/buddies/list');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{
        ...mockBuddyWithStatus,
        addedAt: mockDate.toISOString(),
        buddy: {
          ...mockBuddyWithStatus.buddy,
          lastSeen: mockDate.toISOString()
        }
      }]);
      expect(mockGetBuddyList).toHaveBeenCalledWith('user-1');
    });
  });

  describe('GET /api/buddies/group/:groupName', () => {
    it('should return buddies by group', async () => {
      const mockGetBuddiesByGroup = jest.fn().mockResolvedValue([mockBuddyWithStatus]);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getBuddiesByGroup: mockGetBuddiesByGroup
      }));

      const response = await request(app)
        .get('/api/buddies/group/Friends');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{
        ...mockBuddyWithStatus,
        addedAt: mockDate.toISOString(),
        buddy: {
          ...mockBuddyWithStatus.buddy,
          lastSeen: mockDate.toISOString()
        }
      }]);
      expect(mockGetBuddiesByGroup).toHaveBeenCalledWith('user-1', 'Friends');
    });

    it('should handle URL encoded group names', async () => {
      const mockGetBuddiesByGroup = jest.fn().mockResolvedValue([mockBuddyWithStatus]);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getBuddiesByGroup: mockGetBuddiesByGroup
      }));

      const response = await request(app)
        .get('/api/buddies/group/Best%20Friends');

      expect(response.status).toBe(200);
      expect(mockGetBuddiesByGroup).toHaveBeenCalledWith('user-1', 'Best Friends');
    });
  });

  describe('GET /api/buddies/groups', () => {
    it('should return group names', async () => {
      const mockGroups = ['Buddies', 'Friends', 'Family'];
      const mockGetGroupNames = jest.fn().mockResolvedValue(mockGroups);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getGroupNames: mockGetGroupNames
      }));

      const response = await request(app)
        .get('/api/buddies/groups');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockGroups);
      expect(mockGetGroupNames).toHaveBeenCalledWith('user-1');
    });
  });

  describe('PUT /api/buddies/:buddyId/group', () => {
    it('should successfully update buddy group', async () => {
      const updatedRelationship = { ...mockBuddyRelationship, groupName: 'Family' };
      const mockUpdateBuddyGroup = jest.fn().mockResolvedValue(updatedRelationship);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        updateBuddyGroup: mockUpdateBuddyGroup
      }));

      const response = await request(app)
        .put('/api/buddies/buddy-1/group')
        .send({ groupName: 'Family' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...updatedRelationship,
        addedAt: mockDate.toISOString()
      });
      expect(mockUpdateBuddyGroup).toHaveBeenCalledWith('user-1', 'buddy-1', 'Family');
    });

    it('should return 400 when group name is missing', async () => {
      const response = await request(app)
        .put('/api/buddies/buddy-1/group')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 404 when buddy not found', async () => {
      const mockUpdateBuddyGroup = jest.fn().mockRejectedValue(new Error('Buddy relationship not found'));
      (BuddyService as jest.Mock).mockImplementation(() => ({
        updateBuddyGroup: mockUpdateBuddyGroup
      }));

      const response = await request(app)
        .put('/api/buddies/nonexistent/group')
        .send({ groupName: 'Family' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('BUDDY_NOT_FOUND');
    });
  });

  describe('GET /api/buddies/online', () => {
    it('should return online buddies', async () => {
      const mockGetOnlineBuddies = jest.fn().mockResolvedValue([mockBuddyWithStatus]);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getOnlineBuddies: mockGetOnlineBuddies
      }));

      const response = await request(app)
        .get('/api/buddies/online');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{
        ...mockBuddyWithStatus,
        addedAt: mockDate.toISOString(),
        buddy: {
          ...mockBuddyWithStatus.buddy,
          lastSeen: mockDate.toISOString()
        }
      }]);
      expect(mockGetOnlineBuddies).toHaveBeenCalledWith('user-1');
    });
  });

  describe('GET /api/buddies/offline', () => {
    it('should return offline buddies', async () => {
      const offlineBuddy = {
        ...mockBuddyWithStatus,
        buddy: { ...mockBuddyWithStatus.buddy, status: 'offline' }
      };
      const mockGetOfflineBuddies = jest.fn().mockResolvedValue([offlineBuddy]);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getOfflineBuddies: mockGetOfflineBuddies
      }));

      const response = await request(app)
        .get('/api/buddies/offline');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{
        ...offlineBuddy,
        addedAt: mockDate.toISOString(),
        buddy: {
          ...offlineBuddy.buddy,
          lastSeen: mockDate.toISOString()
        }
      }]);
      expect(mockGetOfflineBuddies).toHaveBeenCalledWith('user-1');
    });
  });

  describe('GET /api/buddies/check/:buddyId', () => {
    it('should return true when users are buddies', async () => {
      const mockAreBuddies = jest.fn().mockResolvedValue(true);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        areBuddies: mockAreBuddies
      }));

      const response = await request(app)
        .get('/api/buddies/check/buddy-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ areBuddies: true });
      expect(mockAreBuddies).toHaveBeenCalledWith('user-1', 'buddy-1');
    });

    it('should return false when users are not buddies', async () => {
      const mockAreBuddies = jest.fn().mockResolvedValue(false);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        areBuddies: mockAreBuddies
      }));

      const response = await request(app)
        .get('/api/buddies/check/buddy-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ areBuddies: false });
    });
  });

  describe('GET /api/buddies/count', () => {
    it('should return buddy count', async () => {
      const mockGetBuddyCount = jest.fn().mockResolvedValue(5);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getBuddyCount: mockGetBuddyCount
      }));

      const response = await request(app)
        .get('/api/buddies/count');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: 5 });
      expect(mockGetBuddyCount).toHaveBeenCalledWith('user-1');
    });
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Mock auth middleware to not add user to request
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = null;
        next();
      });

      const response = await request(app)
        .get('/api/buddies/list');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // Buddy Request Route Tests
  describe('POST /api/buddies/request', () => {
    it('should successfully send a buddy request', async () => {
      const mockBuddyRequest = {
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'buddy-1',
        message: 'Hi, let\'s be buddies!',
        status: 'pending',
        createdAt: mockDate,
        updatedAt: mockDate
      };

      const mockSendBuddyRequest = jest.fn().mockResolvedValue(mockBuddyRequest);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        sendBuddyRequest: mockSendBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/request')
        .send({ screenName: 'buddyuser', message: 'Hi, let\'s be buddies!' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ...mockBuddyRequest,
        createdAt: mockDate.toISOString(),
        updatedAt: mockDate.toISOString()
      });
      expect(mockSendBuddyRequest).toHaveBeenCalledWith('user-1', 'buddyuser', 'Hi, let\'s be buddies!');
    });
  });

  describe('POST /api/buddies/request/:requestId/accept', () => {
    it('should successfully accept a buddy request', async () => {
      const mockAcceptBuddyRequest = jest.fn().mockResolvedValue(mockBuddyRelationship);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        acceptBuddyRequest: mockAcceptBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/request/request-1/accept');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...mockBuddyRelationship,
        addedAt: mockDate.toISOString()
      });
      expect(mockAcceptBuddyRequest).toHaveBeenCalledWith('request-1', 'user-1');
    });

    it('should return 404 when request not found', async () => {
      const mockAcceptBuddyRequest = jest.fn().mockRejectedValue(new Error('Buddy request not found'));
      (BuddyService as jest.Mock).mockImplementation(() => ({
        acceptBuddyRequest: mockAcceptBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/request/nonexistent/accept');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('REQUEST_NOT_FOUND');
    });
  });

  describe('POST /api/buddies/request/:requestId/decline', () => {
    it('should successfully decline a buddy request', async () => {
      const mockDeclineBuddyRequest = jest.fn().mockResolvedValue(true);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        declineBuddyRequest: mockDeclineBuddyRequest
      }));

      const response = await request(app)
        .post('/api/buddies/request/request-1/decline');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Buddy request declined');
      expect(mockDeclineBuddyRequest).toHaveBeenCalledWith('request-1', 'user-1');
    });
  });

  describe('DELETE /api/buddies/request/:requestId', () => {
    it('should successfully cancel a buddy request', async () => {
      const mockCancelBuddyRequest = jest.fn().mockResolvedValue(true);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        cancelBuddyRequest: mockCancelBuddyRequest
      }));

      const response = await request(app)
        .delete('/api/buddies/request/request-1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Buddy request cancelled');
      expect(mockCancelBuddyRequest).toHaveBeenCalledWith('request-1', 'user-1');
    });
  });

  describe('GET /api/buddies/requests/pending', () => {
    it('should return pending buddy requests', async () => {
      const mockRequestWithUsers = {
        id: 'request-1',
        fromUserId: 'buddy-1',
        toUserId: 'user-1',
        message: 'Hi, let\'s be buddies!',
        status: 'pending',
        createdAt: mockDate,
        updatedAt: mockDate,
        fromUser: {
          id: 'buddy-1',
          screenName: 'buddyuser',
          displayName: 'Buddy User'
        },
        toUser: {
          id: 'user-1',
          screenName: 'testuser',
          displayName: 'Test User'
        }
      };

      const mockGetPendingBuddyRequests = jest.fn().mockResolvedValue([mockRequestWithUsers]);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getPendingBuddyRequests: mockGetPendingBuddyRequests
      }));

      const response = await request(app)
        .get('/api/buddies/requests/pending');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{
        ...mockRequestWithUsers,
        createdAt: mockDate.toISOString(),
        updatedAt: mockDate.toISOString()
      }]);
      expect(mockGetPendingBuddyRequests).toHaveBeenCalledWith('user-1');
    });
  });

  describe('GET /api/buddies/requests/sent', () => {
    it('should return sent buddy requests', async () => {
      const mockRequestWithUsers = {
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'buddy-1',
        message: 'Hi, let\'s be buddies!',
        status: 'pending',
        createdAt: mockDate,
        updatedAt: mockDate,
        fromUser: {
          id: 'user-1',
          screenName: 'testuser',
          displayName: 'Test User'
        },
        toUser: {
          id: 'buddy-1',
          screenName: 'buddyuser',
          displayName: 'Buddy User'
        }
      };

      const mockGetSentBuddyRequests = jest.fn().mockResolvedValue([mockRequestWithUsers]);
      (BuddyService as jest.Mock).mockImplementation(() => ({
        getSentBuddyRequests: mockGetSentBuddyRequests
      }));

      const response = await request(app)
        .get('/api/buddies/requests/sent');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{
        ...mockRequestWithUsers,
        createdAt: mockDate.toISOString(),
        updatedAt: mockDate.toISOString()
      }]);
      expect(mockGetSentBuddyRequests).toHaveBeenCalledWith('user-1');
    });
  });
});