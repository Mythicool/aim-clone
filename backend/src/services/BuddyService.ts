import { BuddyRelationshipRepository } from '../repositories/BuddyRelationshipRepository';
import { BuddyRequestRepository } from '../repositories/BuddyRequestRepository';
import { UserRepository } from '../repositories/UserRepository';
import { BuddyRelationship, CreateBuddyRelationshipData, BuddyWithStatus } from '../models/BuddyRelationship';
import { BuddyRequest, CreateBuddyRequestData, BuddyRequestStatus, BuddyRequestWithUsers } from '../models/BuddyRequest';

export class BuddyService {
  constructor(
    private buddyRepository: BuddyRelationshipRepository,
    private buddyRequestRepository: BuddyRequestRepository,
    private userRepository: UserRepository
  ) {}

  async addBuddy(userId: string, buddyScreenName: string, groupName?: string): Promise<BuddyRelationship> {
    // Find the buddy user by screen name
    const buddyUser = await this.userRepository.findByScreenName(buddyScreenName);
    if (!buddyUser) {
      throw new Error('User not found');
    }

    // Check if user is trying to add themselves
    if (buddyUser.id === userId) {
      throw new Error('Cannot add yourself as a buddy');
    }

    // Check if buddy relationship already exists
    const existingRelationship = await this.buddyRepository.findByUserAndBuddy(userId, buddyUser.id);
    if (existingRelationship) {
      throw new Error('Buddy already exists in your list');
    }

    // Create the buddy relationship
    const relationshipData: CreateBuddyRelationshipData = {
      userId,
      buddyId: buddyUser.id,
      groupName: groupName || 'Buddies'
    };

    return await this.buddyRepository.create(relationshipData);
  }

  async removeBuddy(userId: string, buddyId: string): Promise<boolean> {
    // Verify the buddy relationship exists
    const relationship = await this.buddyRepository.findByUserAndBuddy(userId, buddyId);
    if (!relationship) {
      throw new Error('Buddy relationship not found');
    }

    return await this.buddyRepository.deleteByUserAndBuddy(userId, buddyId);
  }

  async removeBuddyByScreenName(userId: string, buddyScreenName: string): Promise<boolean> {
    // Find the buddy user by screen name
    const buddyUser = await this.userRepository.findByScreenName(buddyScreenName);
    if (!buddyUser) {
      throw new Error('User not found');
    }

    return await this.removeBuddy(userId, buddyUser.id);
  }

  async getBuddyList(userId: string): Promise<BuddyWithStatus[]> {
    return await this.buddyRepository.findBuddiesByUserId(userId);
  }

  async getBuddiesByGroup(userId: string, groupName: string): Promise<BuddyWithStatus[]> {
    return await this.buddyRepository.findBuddiesByGroup(userId, groupName);
  }

  async getGroupNames(userId: string): Promise<string[]> {
    return await this.buddyRepository.getGroupNames(userId);
  }

  async updateBuddyGroup(userId: string, buddyId: string, newGroupName: string): Promise<BuddyRelationship | null> {
    // Verify the buddy relationship exists and belongs to the user
    const relationship = await this.buddyRepository.findByUserAndBuddy(userId, buddyId);
    if (!relationship) {
      throw new Error('Buddy relationship not found');
    }

    return await this.buddyRepository.updateGroup(relationship.id, newGroupName);
  }

  async areBuddies(userId: string, buddyId: string): Promise<boolean> {
    return await this.buddyRepository.areBuddies(userId, buddyId);
  }

  async getBuddyCount(userId: string): Promise<number> {
    return await this.buddyRepository.getBuddyCount(userId);
  }

  async getOnlineBuddies(userId: string): Promise<BuddyWithStatus[]> {
    const allBuddies = await this.getBuddyList(userId);
    return allBuddies.filter(buddy => buddy.buddy.status === 'online');
  }

  async getOfflineBuddies(userId: string): Promise<BuddyWithStatus[]> {
    const allBuddies = await this.getBuddyList(userId);
    return allBuddies.filter(buddy => buddy.buddy.status === 'offline');
  }

  // Buddy Request Methods
  async sendBuddyRequest(fromUserId: string, toScreenName: string, message?: string): Promise<BuddyRequest> {
    // Find the target user by screen name
    const toUser = await this.userRepository.findByScreenName(toScreenName);
    if (!toUser) {
      throw new Error('User not found');
    }

    // Check if user is trying to send request to themselves
    if (toUser.id === fromUserId) {
      throw new Error('Cannot send buddy request to yourself');
    }

    // Check if they are already buddies
    const existingRelationship = await this.buddyRepository.findByUserAndBuddy(fromUserId, toUser.id);
    if (existingRelationship) {
      throw new Error('User is already in your buddy list');
    }

    // Check if there's already a pending request
    const existingRequest = await this.buddyRequestRepository.findByUsers(fromUserId, toUser.id);
    if (existingRequest && existingRequest.status === BuddyRequestStatus.PENDING) {
      throw new Error('Buddy request already sent');
    }

    // Check if there's a reverse request (they sent us a request)
    const reverseRequest = await this.buddyRequestRepository.findByUsers(toUser.id, fromUserId);
    if (reverseRequest && reverseRequest.status === BuddyRequestStatus.PENDING) {
      throw new Error('This user has already sent you a buddy request');
    }

    // Create the buddy request
    const requestData: CreateBuddyRequestData = {
      fromUserId,
      toUserId: toUser.id,
      message
    };

    return await this.buddyRequestRepository.create(requestData);
  }

  async acceptBuddyRequest(requestId: string, userId: string): Promise<BuddyRelationship> {
    // Find the request
    const request = await this.buddyRequestRepository.findById(requestId);
    if (!request) {
      throw new Error('Buddy request not found');
    }

    // Verify the request is for this user
    if (request.toUserId !== userId) {
      throw new Error('Unauthorized to accept this request');
    }

    // Verify the request is still pending
    if (request.status !== BuddyRequestStatus.PENDING) {
      throw new Error('Buddy request is no longer pending');
    }

    // Check if they are already buddies (race condition protection)
    const existingRelationship = await this.buddyRepository.findByUserAndBuddy(request.fromUserId, request.toUserId);
    if (existingRelationship) {
      // Update request status and return existing relationship
      await this.buddyRequestRepository.updateStatus(requestId, BuddyRequestStatus.ACCEPTED);
      throw new Error('Users are already buddies');
    }

    // Create buddy relationships (bidirectional)
    const relationship1Data: CreateBuddyRelationshipData = {
      userId: request.fromUserId,
      buddyId: request.toUserId,
      groupName: 'Buddies'
    };

    const relationship2Data: CreateBuddyRelationshipData = {
      userId: request.toUserId,
      buddyId: request.fromUserId,
      groupName: 'Buddies'
    };

    // Create both relationships
    const relationship1 = await this.buddyRepository.create(relationship1Data);
    await this.buddyRepository.create(relationship2Data);

    // Update request status
    await this.buddyRequestRepository.updateStatus(requestId, BuddyRequestStatus.ACCEPTED);

    return relationship1;
  }

  async declineBuddyRequest(requestId: string, userId: string): Promise<boolean> {
    // Find the request
    const request = await this.buddyRequestRepository.findById(requestId);
    if (!request) {
      throw new Error('Buddy request not found');
    }

    // Verify the request is for this user
    if (request.toUserId !== userId) {
      throw new Error('Unauthorized to decline this request');
    }

    // Verify the request is still pending
    if (request.status !== BuddyRequestStatus.PENDING) {
      throw new Error('Buddy request is no longer pending');
    }

    // Update request status
    const updatedRequest = await this.buddyRequestRepository.updateStatus(requestId, BuddyRequestStatus.DECLINED);
    return updatedRequest !== null;
  }

  async cancelBuddyRequest(requestId: string, userId: string): Promise<boolean> {
    // Find the request
    const request = await this.buddyRequestRepository.findById(requestId);
    if (!request) {
      throw new Error('Buddy request not found');
    }

    // Verify the request is from this user
    if (request.fromUserId !== userId) {
      throw new Error('Unauthorized to cancel this request');
    }

    // Verify the request is still pending
    if (request.status !== BuddyRequestStatus.PENDING) {
      throw new Error('Buddy request is no longer pending');
    }

    // Update request status
    const updatedRequest = await this.buddyRequestRepository.updateStatus(requestId, BuddyRequestStatus.CANCELLED);
    return updatedRequest !== null;
  }

  async getPendingBuddyRequests(userId: string): Promise<BuddyRequestWithUsers[]> {
    return await this.buddyRequestRepository.findPendingRequestsForUser(userId);
  }

  async getSentBuddyRequests(userId: string): Promise<BuddyRequestWithUsers[]> {
    return await this.buddyRequestRepository.findSentRequestsForUser(userId);
  }
}