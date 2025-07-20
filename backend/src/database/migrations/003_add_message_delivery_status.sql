-- Migration: Add delivery status to messages table
-- This migration adds columns to track message delivery status

-- Add delivery status columns to messages table
ALTER TABLE messages ADD COLUMN is_delivered BOOLEAN DEFAULT 0;
ALTER TABLE messages ADD COLUMN delivered_at DATETIME DEFAULT NULL;

-- Create index for faster queries on undelivered messages
CREATE INDEX idx_messages_undelivered ON messages(to_user_id, is_delivered) WHERE is_delivered = 0;

-- Update existing messages to be marked as delivered (since they were sent before this feature)
UPDATE messages SET is_delivered = 1, delivered_at = timestamp WHERE is_delivered = 0;
