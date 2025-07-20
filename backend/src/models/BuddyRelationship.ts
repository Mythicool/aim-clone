export interface BuddyRelationship {
  id: string;
  userId: string;
  buddyId: string;
  groupName: string;
  addedAt: Date;
}

export interface CreateBuddyRelationshipData {
  userId: string;
  buddyId: string;
  groupName?: string;
}

export interface BuddyWithStatus extends BuddyRelationship {
  buddy: {
    id: string;
    screenName: string;
    displayName?: string;
    status: string;
    awayMessage?: string;
    lastSeen: Date;
  };
}