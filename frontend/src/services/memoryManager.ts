/**
 * Memory Management Service for AIM Application
 * Handles cleanup of old messages, event listeners, and memory optimization
 */

interface MemoryStats {
  messagesInMemory: number;
  activeEventListeners: number;
  memoryUsage: number;
  lastCleanup: Date;
}

interface ConversationCache {
  [conversationId: string]: {
    messages: any[];
    lastAccessed: Date;
    size: number;
  };
}

interface CleanupOptions {
  maxMessagesPerConversation?: number;
  maxInactiveTime?: number; // in milliseconds
  maxTotalMemoryMB?: number;
  enableAutoCleanup?: boolean;
  cleanupInterval?: number; // in milliseconds
}

class MemoryManager {
  private conversationCache: ConversationCache = {};
  private eventListenerRegistry: Map<string, Set<Function>> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  
  private options: Required<CleanupOptions> = {
    maxMessagesPerConversation: 500,
    maxInactiveTime: 30 * 60 * 1000, // 30 minutes
    maxTotalMemoryMB: 50,
    enableAutoCleanup: true,
    cleanupInterval: 5 * 60 * 1000 // 5 minutes
  };

  constructor(options?: CleanupOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    this.initializePerformanceMonitoring();
    
    if (this.options.enableAutoCleanup) {
      this.startAutoCleanup();
    }

    // Listen for page visibility changes to trigger cleanup
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Listen for memory pressure events
    if ('memory' in performance) {
      this.monitorMemoryPressure();
    }
  }

  /**
   * Register a conversation's messages in the cache
   */
  registerConversation(conversationId: string, messages: any[]): void {
    const size = this.calculateMessageArraySize(messages);
    
    this.conversationCache[conversationId] = {
      messages: [...messages],
      lastAccessed: new Date(),
      size
    };

    // Trigger cleanup if we exceed memory limits
    if (this.getTotalMemoryUsage() > this.options.maxTotalMemoryMB * 1024 * 1024) {
      this.performCleanup();
    }
  }

  /**
   * Update conversation access time and optionally add new messages
   */
  updateConversation(conversationId: string, newMessages?: any[]): void {
    const conversation = this.conversationCache[conversationId];
    if (!conversation) return;

    conversation.lastAccessed = new Date();

    if (newMessages && newMessages.length > 0) {
      conversation.messages.push(...newMessages);
      conversation.size = this.calculateMessageArraySize(conversation.messages);

      // Trim messages if we exceed the limit
      if (conversation.messages.length > this.options.maxMessagesPerConversation) {
        const excessCount = conversation.messages.length - this.options.maxMessagesPerConversation;
        conversation.messages.splice(0, excessCount);
        conversation.size = this.calculateMessageArraySize(conversation.messages);
      }
    }
  }

  /**
   * Get messages for a conversation
   */
  getConversationMessages(conversationId: string): any[] | null {
    const conversation = this.conversationCache[conversationId];
    if (!conversation) return null;

    conversation.lastAccessed = new Date();
    return [...conversation.messages];
  }

  /**
   * Register an event listener for cleanup tracking
   */
  registerEventListener(component: string, event: string, listener: Function): void {
    const key = `${component}:${event}`;
    if (!this.eventListenerRegistry.has(key)) {
      this.eventListenerRegistry.set(key, new Set());
    }
    this.eventListenerRegistry.get(key)!.add(listener);
  }

  /**
   * Unregister an event listener
   */
  unregisterEventListener(component: string, event: string, listener: Function): void {
    const key = `${component}:${event}`;
    const listeners = this.eventListenerRegistry.get(key);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListenerRegistry.delete(key);
      }
    }
  }

  /**
   * Perform memory cleanup
   */
  performCleanup(): MemoryStats {
    const now = new Date();
    let cleanedConversations = 0;
    let cleanedMessages = 0;

    // Clean up inactive conversations
    Object.keys(this.conversationCache).forEach(conversationId => {
      const conversation = this.conversationCache[conversationId];
      const timeSinceAccess = now.getTime() - conversation.lastAccessed.getTime();

      if (timeSinceAccess > this.options.maxInactiveTime) {
        delete this.conversationCache[conversationId];
        cleanedConversations++;
      } else if (conversation.messages.length > this.options.maxMessagesPerConversation) {
        // Trim old messages
        const excessCount = conversation.messages.length - this.options.maxMessagesPerConversation;
        conversation.messages.splice(0, excessCount);
        conversation.size = this.calculateMessageArraySize(conversation.messages);
        cleanedMessages += excessCount;
      }
    });

    // Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }

    console.log(`Memory cleanup completed: ${cleanedConversations} conversations, ${cleanedMessages} messages cleaned`);

    return this.getMemoryStats();
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const totalMessages = Object.values(this.conversationCache)
      .reduce((sum, conv) => sum + conv.messages.length, 0);
    
    const totalEventListeners = Array.from(this.eventListenerRegistry.values())
      .reduce((sum, listeners) => sum + listeners.size, 0);

    return {
      messagesInMemory: totalMessages,
      activeEventListeners: totalEventListeners,
      memoryUsage: this.getTotalMemoryUsage(),
      lastCleanup: new Date()
    };
  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    this.conversationCache = {};
    this.eventListenerRegistry.clear();
    
    if ((window as any).gc) {
      (window as any).gc();
    }
  }

  /**
   * Destroy the memory manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.clearAll();
  }

  // Private methods

  private calculateMessageArraySize(messages: any[]): number {
    // Rough estimation of memory usage
    return messages.reduce((size, msg) => {
      return size + JSON.stringify(msg).length * 2; // Rough estimate for UTF-16
    }, 0);
  }

  private getTotalMemoryUsage(): number {
    return Object.values(this.conversationCache)
      .reduce((total, conv) => total + conv.size, 0);
  }

  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.options.cleanupInterval);
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Page is hidden, perform cleanup
      setTimeout(() => {
        if (document.hidden) {
          this.performCleanup();
        }
      }, 5000); // Wait 5 seconds before cleanup
    }
  }

  private initializePerformanceMonitoring(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'memory') {
            // Handle memory pressure
            this.performCleanup();
          }
        });
      });

      try {
        this.performanceObserver.observe({ entryTypes: ['memory'] });
      } catch (e) {
        // Memory API not supported
        console.warn('Memory performance monitoring not supported');
      }
    }
  }

  private monitorMemoryPressure(): void {
    // Check memory usage periodically
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (usedPercent > 80) {
          console.warn('High memory usage detected, performing cleanup');
          this.performCleanup();
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

// Create singleton instance
export const memoryManager = new MemoryManager();

// Export types for use in other components
export type { MemoryStats, CleanupOptions };
