export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  isDelivered: boolean;
  deliveredAt?: Date;
}

export interface CreateMessageData {
  fromUserId: string;
  toUserId: string;
  content: string;
}

export interface MessageWithUsers extends Message {
  fromUser: {
    id: string;
    screenName: string;
  };
  toUser: {
    id: string;
    screenName: string;
  };
}