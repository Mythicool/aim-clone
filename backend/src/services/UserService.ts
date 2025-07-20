import { User, UserProfile, UserStatus, UpdateUserData } from '../models/User';
import { UserRepository } from '../repositories/UserRepository';

export interface UserProfileUpdate {
  displayName?: string;
  location?: string;
  interests?: string;
  awayMessage?: string;
}

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async getUserByScreenName(screenName: string): Promise<User | null> {
    return await this.userRepository.findByScreenName(screenName);
  }

  async updateUserStatus(userId: string, status: UserStatus, awayMessage?: string): Promise<User | null> {
    const updateData: UpdateUserData = { status };
    
    // If away message is provided and status is AWAY, update the away message
    if (status === UserStatus.AWAY && awayMessage !== undefined) {
      const sanitizedMessage = this.sanitizeAwayMessage(awayMessage);
      if (sanitizedMessage) {
        this.validateAwayMessage(sanitizedMessage);
      }
      updateData.awayMessage = sanitizedMessage || undefined;
    }
    
    // If status is not AWAY, clear away message
    if (status !== UserStatus.AWAY) {
      updateData.awayMessage = null;
    }
    
    return await this.userRepository.update(userId, updateData);
  }

  async updateProfile(userId: string, profileData: UserProfileUpdate): Promise<User | null> {
    // Validate and sanitize profile data
    const sanitizedData = this.sanitizeProfileData(profileData);
    this.validateProfileData(sanitizedData);

    const updateData: UpdateUserData = {
      ...sanitizedData
    };

    return await this.userRepository.update(userId, updateData);
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    return {
      displayName: user.displayName,
      location: user.location,
      interests: user.interests,
      awayMessage: user.awayMessage
    };
  }

  async getOnlineUsers(): Promise<User[]> {
    return await this.userRepository.findOnlineUsers();
  }

  async setAwayMessage(userId: string, awayMessage: string): Promise<User | null> {
    const sanitizedMessage = this.sanitizeAwayMessage(awayMessage);
    if (sanitizedMessage) {
      this.validateAwayMessage(sanitizedMessage);
    }

    const updateData: UpdateUserData = {
      awayMessage: sanitizedMessage || undefined,
      status: UserStatus.AWAY
    };

    return await this.userRepository.update(userId, updateData);
  }

  async clearAwayMessage(userId: string): Promise<User | null> {
    const updateData: UpdateUserData = {
      awayMessage: null,
      status: UserStatus.ONLINE
    };

    return await this.userRepository.update(userId, updateData);
  }

  // Remove sensitive data from user object
  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private sanitizeProfileData(profileData: UserProfileUpdate): any {
    const sanitized: any = {};

    if (profileData.displayName !== undefined) {
      const trimmed = profileData.displayName?.trim();
      sanitized.displayName = (trimmed && trimmed.length > 0) ? trimmed : null;
    }

    if (profileData.location !== undefined) {
      const trimmed = profileData.location?.trim();
      sanitized.location = (trimmed && trimmed.length > 0) ? trimmed : null;
    }

    if (profileData.interests !== undefined) {
      const trimmed = profileData.interests?.trim();
      sanitized.interests = (trimmed && trimmed.length > 0) ? trimmed : null;
    }

    if (profileData.awayMessage !== undefined) {
      const sanitizedMessage = this.sanitizeAwayMessage(profileData.awayMessage);
      sanitized.awayMessage = sanitizedMessage;
    }

    return sanitized;
  }

  private sanitizeAwayMessage(message: string | undefined | null): string | null {
    if (!message) return null;
    
    // Remove HTML tags and entities, then trim whitespace
    const sanitized = message
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove HTML entities
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .trim();
    
    return sanitized || null;
  }

  private validateProfileData(profileData: UserProfileUpdate): void {
    if (profileData.displayName !== undefined && profileData.displayName !== null) {
      if (profileData.displayName.length > 50) {
        throw new Error('Display name cannot exceed 50 characters');
      }
    }

    if (profileData.location !== undefined && profileData.location !== null) {
      if (profileData.location.length > 100) {
        throw new Error('Location cannot exceed 100 characters');
      }
    }

    if (profileData.interests !== undefined && profileData.interests !== null) {
      if (profileData.interests.length > 500) {
        throw new Error('Interests cannot exceed 500 characters');
      }
    }

    if (profileData.awayMessage !== undefined && profileData.awayMessage !== null) {
      this.validateAwayMessage(profileData.awayMessage);
    }
  }

  private validateAwayMessage(message: string): void {
    if (message.length > 200) {
      throw new Error('Away message cannot exceed 200 characters');
    }
  }
}