import { BuddyService } from '../../src/services/BuddyService';
import { BuddyRelationshipRepository } from '../../src/repositories/BuddyRelationshipRepository';
import { BuddyRequestRepository } from '../../src/repositories/BuddyRequestRepository';
import { UserRepository } from '../../src/repositories/UserRepository';
import { BuddyRelationship, CreateBuddyRelationshipData, BuddyWithStatus } from '../../src/models/BuddyRelationship';
import { BuddyRequest, BuddyRequestStatus, BuddyRequestWithUsers } from '../../src/models/BuddyRequest';
import { User, UserStatus } from '../../src/models/User';

// Mock the repositories
jest.mock('../../src/repositories/BuddyRelationshipRepository');
jest.mock('../../src/repositories/BuddyRequestRepository');
jest.mock('../../src/repositories/UserRepository');

describe('BuddyService', () => {
  let buddyService: BuddyService;
  let mockBuddyRepository: jest.Mocked<BuddyRelationshipRepository>;
  let mockBuddyRequestRepository: jest.Mocked<BuddyRequestRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser: User = {
    id: 'user-1',
    screenName: 'testuser',
    email: 'test@example.com',
    passwordHash: 'hashedpassword',
    displayName: 'Test User',
    status: UserStatus.ONLINE,
    awayMessage: undefined,
    lastSeen: new Date(),
    createdAt: new Date()
  };

  const mockBuddyUser: User = {
    id: 'buddy-1',
    screenName: 'buddyuser',
    email: 'buddy@example.com',
    passwordHash: 'hashedpassword',
    displayName: 'Buddy User',
    status: UserStatus.ONLINE,
    awayMessage: undefined,
    lastSeen: new Date(),
    createdAt: new Date()
  };

  const mockBuddyRelationship: BuddyRelationship = {
    id: 'relationship-1',
    userId: 'user-1',
    buddyId: 'buddy-1',
    groupName: 'Buddies',
    addedAt: new Date()
  };

  const mockBuddyWithStatus: BuddyWithStatus = {
    ...mockBuddyRelationship,
    buddy: {
      id: mockBuddyUser.id,
      screenName: mockBuddyUser.screenName,
      displayName: mockBuddyUser.displayName,
      status: mockBuddyUser.status,
      awayMessage: mockBuddyUser.awayMessage,
      lastSeen: mockBuddyUser.lastSeen
    }
  };

  beforeEach(() => {
    mockBuddyRepository = new BuddyRelationshipRepository({} as any) as jest.Mocked<BuddyRelationshipRepository>;
    mockBuddyRequestRepository = new BuddyRequestRepository({} as any) as jest.Mocked<BuddyRequestRepository>;
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    buddyService = new BuddyService(mockBuddyRepository, mockBuddyRequestRepository, mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addBuddy', () => {
    it('should successfully add a buddy', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockBuddyUser);
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(null);
      mockBuddyRepository.create.mockResolvedValue(mockBuddyRelationship);

      const result = await buddyService.addBuddy('user-1', 'buddyuser', 'Friends');

      expect(mockUserRepository.findByScreenName).toHaveBeenCalledWith('buddyuser');
      expect(mockBuddyRepository.findByUserAndBuddy).toHaveBeenCalledWith('user-1', 'buddy-1');
      expect(mockBuddyRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        buddyId: 'buddy-1',
        groupName: 'Friends'
      });
      expect(result).toEqual(mockBuddyRelationship);
    });

    it('should use default group name when not provided', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockBuddyUser);
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(null);
      mockBuddyRepository.create.mockResolvedValue(mockBuddyRelationship);

      await buddyService.addBuddy('user-1', 'buddyuser');

      expect(mockBuddyRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        buddyId: 'buddy-1',
        groupName: 'Buddies'
      });
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(null);

      await expect(buddyService.addBuddy('user-1', 'nonexistent')).rejects.toThrow('User not found');
    });

    it('should throw error when trying to add self as buddy', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockUser);

      await expect(buddyService.addBuddy('user-1', 'testuser')).rejects.toThrow('Cannot add yourself as a buddy');
    });

    it('should throw error when buddy already exists', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockBuddyUser);
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(mockBuddyRelationship);

      await expect(buddyService.addBuddy('user-1', 'buddyuser')).rejects.toThrow('Buddy already exists in your list');
    });
  });

  describe('removeBuddy', () => {
    it('should successfully remove a buddy', async () => {
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(mockBuddyRelationship);
      mockBuddyRepository.deleteByUserAndBuddy.mockResolvedValue(true);

      const result = await buddyService.removeBuddy('user-1', 'buddy-1');

      expect(mockBuddyRepository.findByUserAndBuddy).toHaveBeenCalledWith('user-1', 'buddy-1');
      expect(mockBuddyRepository.deleteByUserAndBuddy).toHaveBeenCalledWith('user-1', 'buddy-1');
      expect(result).toBe(true);
    });

    it('should throw error when buddy relationship not found', async () => {
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(null);

      await expect(buddyService.removeBuddy('user-1', 'buddy-1')).rejects.toThrow('Buddy relationship not found');
    });
  });

  describe('removeBuddyByScreenName', () => {
    it('should successfully remove buddy by screen name', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockBuddyUser);
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(mockBuddyRelationship);
      mockBuddyRepository.deleteByUserAndBuddy.mockResolvedValue(true);

      const result = await buddyService.removeBuddyByScreenName('user-1', 'buddyuser');

      expect(mockUserRepository.findByScreenName).toHaveBeenCalledWith('buddyuser');
      expect(result).toBe(true);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(null);

      await expect(buddyService.removeBuddyByScreenName('user-1', 'nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('getBuddyList', () => {
    it('should return buddy list with status', async () => {
      mockBuddyRepository.findBuddiesByUserId.mockResolvedValue([mockBuddyWithStatus]);

      const result = await buddyService.getBuddyList('user-1');

      expect(mockBuddyRepository.findBuddiesByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockBuddyWithStatus]);
    });
  });

  describe('getBuddiesByGroup', () => {
    it('should return buddies by group', async () => {
      mockBuddyRepository.findBuddiesByGroup.mockResolvedValue([mockBuddyWithStatus]);

      const result = await buddyService.getBuddiesByGroup('user-1', 'Friends');

      expect(mockBuddyRepository.findBuddiesByGroup).toHaveBeenCalledWith('user-1', 'Friends');
      expect(result).toEqual([mockBuddyWithStatus]);
    });
  });

  describe('getGroupNames', () => {
    it('should return group names', async () => {
      const mockGroups = ['Buddies', 'Friends', 'Family'];
      mockBuddyRepository.getGroupNames.mockResolvedValue(mockGroups);

      const result = await buddyService.getGroupNames('user-1');

      expect(mockBuddyRepository.getGroupNames).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockGroups);
    });
  });

  describe('updateBuddyGroup', () => {
    it('should successfully update buddy group', async () => {
      const updatedRelationship = { ...mockBuddyRelationship, groupName: 'Family' };
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(mockBuddyRelationship);
      mockBuddyRepository.updateGroup.mockResolvedValue(updatedRelationship);

      const result = await buddyService.updateBuddyGroup('user-1', 'buddy-1', 'Family');

      expect(mockBuddyRepository.findByUserAndBuddy).toHaveBeenCalledWith('user-1', 'buddy-1');
      expect(mockBuddyRepository.updateGroup).toHaveBeenCalledWith('relationship-1', 'Family');
      expect(result).toEqual(updatedRelationship);
    });

    it('should throw error when buddy relationship not found', async () => {
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(null);

      await expect(buddyService.updateBuddyGroup('user-1', 'buddy-1', 'Family')).rejects.toThrow('Buddy relationship not found');
    });
  });

  describe('areBuddies', () => {
    it('should return true when users are buddies', async () => {
      mockBuddyRepository.areBuddies.mockResolvedValue(true);

      const result = await buddyService.areBuddies('user-1', 'buddy-1');

      expect(mockBuddyRepository.areBuddies).toHaveBeenCalledWith('user-1', 'buddy-1');
      expect(result).toBe(true);
    });

    it('should return false when users are not buddies', async () => {
      mockBuddyRepository.areBuddies.mockResolvedValue(false);

      const result = await buddyService.areBuddies('user-1', 'buddy-1');

      expect(result).toBe(false);
    });
  });

  describe('getBuddyCount', () => {
    it('should return buddy count', async () => {
      mockBuddyRepository.getBuddyCount.mockResolvedValue(5);

      const result = await buddyService.getBuddyCount('user-1');

      expect(mockBuddyRepository.getBuddyCount).toHaveBeenCalledWith('user-1');
      expect(result).toBe(5);
    });
  });

  describe('getOnlineBuddies', () => {
    it('should return only online buddies', async () => {
      const offlineBuddy: BuddyWithStatus = {
        ...mockBuddyWithStatus,
        buddy: { ...mockBuddyWithStatus.buddy, status: 'offline' }
      };
      mockBuddyRepository.findBuddiesByUserId.mockResolvedValue([mockBuddyWithStatus, offlineBuddy]);

      const result = await buddyService.getOnlineBuddies('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].buddy.status).toBe('online');
    });
  });

  describe('getOfflineBuddies', () => {
    it('should return only offline buddies', async () => {
      const offlineBuddy: BuddyWithStatus = {
        ...mockBuddyWithStatus,
        buddy: { ...mockBuddyWithStatus.buddy, status: 'offline' }
      };
      mockBuddyRepository.findBuddiesByUserId.mockResolvedValue([mockBuddyWithStatus, offlineBuddy]);

      const result = await buddyService.getOfflineBuddies('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].buddy.status).toBe('offline');
    });
  });

  // Buddy Request Tests
  describe('sendBuddyRequest', () => {
    const mockBuddyRequest: BuddyRequest = {
      id: 'request-1',
      fromUserId: 'user-1',
      toUserId: 'buddy-1',
      message: 'Hi, let\'s be buddies!',
      status: BuddyRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should successfully send a buddy request', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockBuddyUser);
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(null);
      mockBuddyRequestRepository.findByUsers.mockResolvedValue(null);
      mockBuddyRequestRepository.create.mockResolvedValue(mockBuddyRequest);

      const result = await buddyService.sendBuddyRequest('user-1', 'buddyuser', 'Hi, let\'s be buddies!');

      expect(mockUserRepository.findByScreenName).toHaveBeenCalledWith('buddyuser');
      expect(mockBuddyRepository.findByUserAndBuddy).toHaveBeenCalledWith('user-1', 'buddy-1');
      expect(mockBuddyRequestRepository.findByUsers).toHaveBeenCalledWith('user-1', 'buddy-1');
      expect(mockBuddyRequestRepository.create).toHaveBeenCalledWith({
        fromUserId: 'user-1',
        toUserId: 'buddy-1',
        message: 'Hi, let\'s be buddies!'
      });
      expect(result).toEqual(mockBuddyRequest);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(null);

      await expect(buddyService.sendBuddyRequest('user-1', 'nonexistent')).rejects.toThrow('User not found');
    });

    it('should throw error when trying to send request to self', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockUser);

      await expect(buddyService.sendBuddyRequest('user-1', 'testuser')).rejects.toThrow('Cannot send buddy request to yourself');
    });

    it('should throw error when users are already buddies', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockBuddyUser);
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(mockBuddyRelationship);

      await expect(buddyService.sendBuddyRequest('user-1', 'buddyuser')).rejects.toThrow('User is already in your buddy list');
    });

    it('should throw error when request already exists', async () => {
      mockUserRepository.findByScreenName.mockResolvedValue(mockBuddyUser);
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(null);
      mockBuddyRequestRepository.findByUsers.mockResolvedValue(mockBuddyRequest);

      await expect(buddyService.sendBuddyRequest('user-1', 'buddyuser')).rejects.toThrow('Buddy request already sent');
    });
  });

  describe('acceptBuddyRequest', () => {
    const mockBuddyRequest: BuddyRequest = {
      id: 'request-1',
      fromUserId: 'buddy-1',
      toUserId: 'user-1',
      message: 'Hi, let\'s be buddies!',
      status: BuddyRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should successfully accept a buddy request', async () => {
      mockBuddyRequestRepository.findById.mockResolvedValue(mockBuddyRequest);
      mockBuddyRepository.findByUserAndBuddy.mockResolvedValue(null);
      mockBuddyRepository.create.mockResolvedValueOnce(mockBuddyRelationship).mockResolvedValueOnce(mockBuddyRelationship);
      mockBuddyRequestRepository.updateStatus.mockResolvedValue({ ...mockBuddyRequest, status: BuddyRequestStatus.ACCEPTED });

      const result = await buddyService.acceptBuddyRequest('request-1', 'user-1');

      expect(mockBuddyRequestRepository.findById).toHaveBeenCalledWith('request-1');
      expect(mockBuddyRepository.create).toHaveBeenCalledTimes(2);
      expect(mockBuddyRequestRepository.updateStatus).toHaveBeenCalledWith('request-1', BuddyRequestStatus.ACCEPTED);
      expect(result).toEqual(mockBuddyRelationship);
    });

    it('should throw error when request not found', async () => {
      mockBuddyRequestRepository.findById.mockResolvedValue(null);

      await expect(buddyService.acceptBuddyRequest('request-1', 'user-1')).rejects.toThrow('Buddy request not found');
    });

    it('should throw error when unauthorized', async () => {
      mockBuddyRequestRepository.findById.mockResolvedValue(mockBuddyRequest);

      await expect(buddyService.acceptBuddyRequest('request-1', 'wrong-user')).rejects.toThrow('Unauthorized to accept this request');
    });

    it('should throw error when request is not pending', async () => {
      const acceptedRequest = { ...mockBuddyRequest, status: BuddyRequestStatus.ACCEPTED };
      mockBuddyRequestRepository.findById.mockResolvedValue(acceptedRequest);

      await expect(buddyService.acceptBuddyRequest('request-1', 'user-1')).rejects.toThrow('Buddy request is no longer pending');
    });
  });

  describe('declineBuddyRequest', () => {
    const mockBuddyRequest: BuddyRequest = {
      id: 'request-1',
      fromUserId: 'buddy-1',
      toUserId: 'user-1',
      message: 'Hi, let\'s be buddies!',
      status: BuddyRequestStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should successfully decline a buddy request', async () => {
      mockBuddyRequestRepository.findById.mockResolvedValue(mockBuddyRequest);
      mockBuddyRequestRepository.updateStatus.mockResolvedValue({ ...mockBuddyRequest, status: BuddyRequestStatus.DECLINED });

      const result = await buddyService.declineBuddyRequest('request-1', 'user-1');

      expect(mockBuddyRequestRepository.findById).toHaveBeenCalledWith('request-1');
      expect(mockBuddyRequestRepository.updateStatus).toHaveBeenCalledWith('request-1', BuddyRequestStatus.DECLINED);
      expect(result).toBe(true);
    });

    it('should throw error when request not found', async () => {
      mockBuddyRequestRepository.findById.mockResolvedValue(null);

      await expect(buddyService.declineBuddyRequest('request-1', 'user-1')).rejects.toThrow('Buddy request not found');
    });
  });

  describe('getPendingBuddyRequests', () => {
    it('should return pending buddy requests', async () => {
      const mockRequestWithUsers: BuddyRequestWithUsers = {
        id: 'request-1',
        fromUserId: 'buddy-1',
        toUserId: 'user-1',
        message: 'Hi, let\'s be buddies!',
        status: BuddyRequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
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

      mockBuddyRequestRepository.findPendingRequestsForUser.mockResolvedValue([mockRequestWithUsers]);

      const result = await buddyService.getPendingBuddyRequests('user-1');

      expect(mockBuddyRequestRepository.findPendingRequestsForUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockRequestWithUsers]);
    });
  });

  describe('getSentBuddyRequests', () => {
    it('should return sent buddy requests', async () => {
      const mockRequestWithUsers: BuddyRequestWithUsers = {
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'buddy-1',
        message: 'Hi, let\'s be buddies!',
        status: BuddyRequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
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

      mockBuddyRequestRepository.findSentRequestsForUser.mockResolvedValue([mockRequestWithUsers]);

      const result = await buddyService.getSentBuddyRequests('user-1');

      expect(mockBuddyRequestRepository.findSentRequestsForUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockRequestWithUsers]);
    });
  });
});