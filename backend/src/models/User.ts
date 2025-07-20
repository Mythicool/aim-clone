export interface User {
  id: string;
  screenName: string;
  email: string;
  passwordHash: string;
  displayName?: string;
  location?: string;
  interests?: string;
  awayMessage?: string;
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

export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  INVISIBLE = 'invisible',
  OFFLINE = 'offline'
}

export interface CreateUserData {
  screenName: string;
  email: string;
  passwordHash: string;
  displayName?: string;
}

export interface UpdateUserData {
  displayName?: string | null;
  location?: string | null;
  interests?: string | null;
  awayMessage?: string | null;
  status?: UserStatus;
}