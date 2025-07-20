interface QueuedMessage {
  id: string;
  toUserId: string;
  content: string;
  timestamp: Date;
  attempts: number;
  maxAttempts: number;
}

interface OfflineMessageQueueOptions {
  maxQueueSize?: number;
  maxAttempts?: number;
  retryDelay?: number;
  persistToStorage?: boolean;
}

class OfflineMessageQueue {
  private queue: Map<string, QueuedMessage> = new Map();
  private options: Required<OfflineMessageQueueOptions> = {
    maxQueueSize: 100,
    maxAttempts: 3,
    retryDelay: 5000,
    persistToStorage: true
  };
  private retryTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(options?: OfflineMessageQueueOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Load persisted queue on initialization
    if (this.options.persistToStorage) {
      this.loadFromStorage();
    }
  }

  /**
   * Add a message to the queue
   */
  enqueue(toUserId: string, content: string): string {
    const messageId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check queue size limit
    if (this.queue.size >= this.options.maxQueueSize) {
      // Remove oldest message
      const oldestId = Array.from(this.queue.keys())[0];
      this.queue.delete(oldestId);
      this.emit('message:dropped', { messageId: oldestId, reason: 'queue_full' });
    }

    const queuedMessage: QueuedMessage = {
      id: messageId,
      toUserId,
      content,
      timestamp: new Date(),
      attempts: 0,
      maxAttempts: this.options.maxAttempts
    };

    this.queue.set(messageId, queuedMessage);
    
    if (this.options.persistToStorage) {
      this.saveToStorage();
    }

    this.emit('message:queued', { messageId, toUserId, content });
    
    return messageId;
  }

  /**
   * Process the queue when connection is restored
   */
  async processQueue(sendFunction: (toUserId: string, content: string) => Promise<boolean>): Promise<void> {
    if (this.queue.size === 0) return;

    console.log(`Processing ${this.queue.size} queued messages`);
    
    const messages = Array.from(this.queue.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (const message of messages) {
      try {
        message.attempts++;
        
        const success = await sendFunction(message.toUserId, message.content);
        
        if (success) {
          this.queue.delete(message.id);
          this.emit('message:sent', { 
            messageId: message.id, 
            toUserId: message.toUserId,
            attempts: message.attempts 
          });
        } else {
          throw new Error('Send function returned false');
        }
      } catch (error) {
        console.error(`Failed to send queued message ${message.id}:`, error);
        
        if (message.attempts >= message.maxAttempts) {
          // Max attempts reached, remove from queue
          this.queue.delete(message.id);
          this.emit('message:failed', { 
            messageId: message.id, 
            toUserId: message.toUserId,
            error: error instanceof Error ? error.message : 'Unknown error',
            attempts: message.attempts 
          });
        } else {
          // Will retry later
          this.emit('message:retry', { 
            messageId: message.id, 
            toUserId: message.toUserId,
            attempt: message.attempts,
            maxAttempts: message.maxAttempts 
          });
        }
      }
    }

    if (this.options.persistToStorage) {
      this.saveToStorage();
    }

    // Schedule retry for failed messages
    if (this.queue.size > 0) {
      this.scheduleRetry(sendFunction);
    }
  }

  /**
   * Schedule retry for failed messages
   */
  private scheduleRetry(sendFunction: (toUserId: string, content: string) => Promise<boolean>): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.retryTimer = setTimeout(() => {
      this.processQueue(sendFunction);
    }, this.options.retryDelay);
  }

  /**
   * Get queue status
   */
  getStatus(): { size: number; messages: QueuedMessage[] } {
    return {
      size: this.queue.size,
      messages: Array.from(this.queue.values())
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    const clearedCount = this.queue.size;
    this.queue.clear();
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.options.persistToStorage) {
      this.saveToStorage();
    }

    this.emit('queue:cleared', { clearedCount });
  }

  /**
   * Remove a specific message from the queue
   */
  remove(messageId: string): boolean {
    const removed = this.queue.delete(messageId);
    
    if (removed && this.options.persistToStorage) {
      this.saveToStorage();
    }

    return removed;
  }

  /**
   * Persist queue to localStorage
   */
  private saveToStorage(): void {
    try {
      const queueData = Array.from(this.queue.entries()).map(([id, message]) => ({
        id,
        ...message,
        timestamp: message.timestamp.toISOString()
      }));
      
      localStorage.setItem('aim_offline_message_queue', JSON.stringify(queueData));
    } catch (error) {
      console.error('Failed to save message queue to storage:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('aim_offline_message_queue');
      if (!stored) return;

      const queueData = JSON.parse(stored);
      
      for (const item of queueData) {
        const message: QueuedMessage = {
          ...item,
          timestamp: new Date(item.timestamp)
        };
        this.queue.set(item.id, message);
      }

      console.log(`Loaded ${this.queue.size} messages from offline queue`);
    } catch (error) {
      console.error('Failed to load message queue from storage:', error);
    }
  }

  // Event emitter methods
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    
    this.eventListeners.clear();
  }
}

export const offlineMessageQueue = new OfflineMessageQueue();
