export interface User {
  id: string;
  screenName: string;
  email: string;
  passwordHash: string;
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

// WebSocket Event Types
export interface SocketEvents {
  // Client to Server
  'user:connect': (data: { userId: string }) => void;
  'user:disconnect': () => void;
  'user:status-change': (data: { status: UserStatus; awayMessage?: string }) => void;
  'message:send': (data: { toUserId: string; content: string }) => void;
  'buddy:add': (data: { screenName: string }) => void;
  'buddy:remove': (data: { buddyId: string }) => void;
  'heartbeat': () => void;

  // Server to Client
  'buddy:online': (data: { userId: string; screenName: string; status: UserStatus }) => void;
  'buddy:offline': (data: { userId: string; screenName: string }) => void;
  'buddy:status-change': (data: { userId: string; screenName: string; status: UserStatus; awayMessage?: string }) => void;
  'message:receive': (data: Message) => void;
  'buddy:added': (data: Buddy) => void;
  'connection:established': (data: { userId: string; onlineUsers: string[] }) => void;
  'error': (data: { code: string; message: string }) => void;
}