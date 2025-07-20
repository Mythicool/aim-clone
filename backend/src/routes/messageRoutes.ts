import express from 'express';
import { DatabaseService } from '../database/DatabaseService';
import { MessageService } from '../services/MessageService';
import { authMiddleware } from '../middleware/authMiddleware';
import { CreateMessageData } from '../models/Message';

const router = express.Router();

// Apply authentication middleware to all message routes
router.use(authMiddleware);

// Get conversation history between current user and another user with pagination
router.get('/conversation/:userId', async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = req.params.userId;

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 messages per page
    const offset = page * limit;

    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const messageService = new MessageService(db);

    // Get messages and total count
    const messages = await messageService.getConversation(currentUserId, otherUserId, limit, offset);
    const totalCount = await messageService.getConversationCount(currentUserId, otherUserId);
    const hasMore = (offset + messages.length) < totalCount;

    res.json({
      messages,
      totalCount,
      hasMore,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get conversation with user details
router.get('/conversation-with-users/:userId', async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = req.params.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const messageService = new MessageService(db);
    
    const messages = await messageService.getConversationWithUsers(currentUserId, otherUserId, limit);
    
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching conversation with users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch conversation with users',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send a message (REST API fallback for when WebSockets are not available)
router.post('/send', async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    const fromUserId = req.user!.id;
    
    if (!toUserId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const messageData: CreateMessageData = {
      fromUserId,
      toUserId,
      content
    };
    
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const messageService = new MessageService(db);
    
    const message = await messageService.sendMessage(messageData);
    
    res.status(201).json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mark messages as read
router.post('/mark-read/:userId', async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = req.params.userId;
    
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const messageService = new MessageService(db);
    
    await messageService.markConversationAsRead(currentUserId, otherUserId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ 
      error: 'Failed to mark messages as read',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get unread message count
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const messageService = new MessageService(db);
    
    const count = await messageService.getUnreadCount(userId);
    
    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ 
      error: 'Failed to get unread count',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get unread message count from a specific user
router.get('/unread-count/:userId', async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const fromUserId = req.params.userId;
    
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const messageService = new MessageService(db);
    
    const count = await messageService.getUnreadCountFromUser(currentUserId, fromUserId);
    
    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count from user:', error);
    res.status(500).json({ 
      error: 'Failed to get unread count from user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a conversation
router.delete('/conversation/:userId', async (req, res) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = req.params.userId;
    
    const dbService = DatabaseService.getInstance();
    const db = await dbService.getDb();
    const messageService = new MessageService(db);
    
    const deletedCount = await messageService.deleteConversation(currentUserId, otherUserId);
    
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ 
      error: 'Failed to delete conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;