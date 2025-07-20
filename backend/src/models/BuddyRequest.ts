export interface BuddyRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  message?: string;
  status: BuddyRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum BuddyRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled'
}

export interface CreateBuddyRequestData {
  fromUserId: string;
  toUserId: string;
  message?: string;
}

export interface BuddyRequestWithUsers extends BuddyRequest {
  fromUser: {
    id: string;
    screenName: string;
    displayName?: string;
  };
  toUser: {
    id: string;
    screenName: string;
    displayName?: string;
  };
}