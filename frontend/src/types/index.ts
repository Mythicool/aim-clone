export interface User {
  id: string;
  screenName: string;
  email: string;
  profile: UserProfile;
  status: UserStatus;
  lastSeen: Date;
  createdAt: Date;
}

export interface UserProfile {
  displayName?: string;
  location?: string;
  interests?: string;
  awayMessage?: string;
}

export const UserStatus = {
  ONLINE: 'online',
  AWAY: 'away',
  INVISIBLE: 'invisible',
  OFFLINE: 'offline'
} as const;

export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
}

export interface BuddyRelationship {
  id: string;
  userId: string;
  buddyId: string;
  groupName?: string;
  addedAt: Date;
}

export interface Buddy extends User {
  relationship: BuddyRelationship;
}

export interface AuthToken {
  token: string;
  user: User;
  expiresAt: Date;
}