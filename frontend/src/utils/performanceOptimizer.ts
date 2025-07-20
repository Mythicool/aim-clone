/**
 * Performance Optimizer Utility
 * Provides automated performance optimization and monitoring
 */

import { memoryManager } from '../services/memoryManager';
import { socketService } from '../services/socket';

interface OptimizationConfig {
  enableAutoCleanup: boolean;
  memoryThreshold: number; // MB
  messageThreshold: number;
  listenerThreshold: number;
  optimizationInterval: number; // ms
  enableLogging: boolean;
}

interface OptimizationResult {
  timestamp: Date;
  type: 'memory' | 'connection' | 'cache' | 'gc';
  before: any;
  after: any;
  improvement: number;
  success: boolean;
}

class PerformanceOptimizer {
  private config: OptimizationConfig = {
    enableAutoCleanup: true,
    memoryThreshold: 100, // 100MB
    messageThreshold: 1000,
    listenerThreshold: 50,
    optimizationInterval: 30000, // 30 seconds
    enableLogging: true
  };

  private optimizationHistory: OptimizationResult[] = [];
  private optimizationTimer: NodeJS.Timeout | null = null;
  private isOptimizing = false;

  constructor(config?: Partial<OptimizationConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.enableAutoCleanup) {
      this.startAutoOptimization();
    }

    // Listen for performance events
    this.setupPerformanceListeners();
  }

  /**
   * Start automatic optimization
   */
  startAutoOptimization(): void {
    if (this.optimizationTimer) return;

    this.optimizationTimer = setInterval(() => {
      this.performOptimization();
    }, this.config.optimizationInterval);

    this.log('Auto-optimization started');
  }

  /**
   * Stop automatic optimization
   */
  stopAutoOptimization(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
      this.log('Auto-optimization stopped');
    }
  }

  /**
   * Perform comprehensive optimization
   */
  async performOptimization(): Promise<OptimizationResult[]> {
    if (this.isOptimizing) return [];

    this.isOptimizing = true;
    const results: OptimizationResult[] = [];

    try {
      // Memory optimization
      const memoryResult = await this.optimizeMemory();
      if (memoryResult) results.push(memoryResult);

      // Connection optimization
      const connectionResult = await this.optimizeConnection();
      if (connectionResult) results.push(connectionResult);

      // Cache optimization
      const cacheResult = await this.optimizeCache();
      if (cacheResult) results.push(cacheResult);

      // Garbage collection
      const gcResult = await this.performGarbageCollection();
      if (gcResult) results.push(gcResult);

      // Store results
      this.optimizationHistory.push(...results);
      
      // Keep only last 50 optimization results
      if (this.optimizationHistory.length > 50) {
        this.optimizationHistory = this.optimizationHistory.slice(-50);
      }

      this.log(`Optimization completed: ${results.length} improvements made`);
      
    } catch (error) {
      this.log(`Optimization error: ${error}`);
    } finally {
      this.isOptimizing = false;
    }

    return results;
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemory(): Promise<OptimizationResult | null> {
    const beforeStats = memoryManager.getMemoryStats();
    
    // Check if optimization is needed
    const needsOptimization = 
      beforeStats.messagesInMemory > this.config.messageThreshold ||
      beforeStats.activeEventListeners > this.config.listenerThreshold;

    if (!needsOptimization) return null;

    // Perform cleanup
    const cleanupResult = memoryManager.performCleanup();
    const afterStats = memoryManager.getMemoryStats();

    const improvement = beforeStats.messagesInMemory - afterStats.messagesInMemory;

    return {
      timestamp: new Date(),
      type: 'memory',
      before: beforeStats,
      after: afterStats,
      improvement,
      success: improvement > 0
    };
  }

  /**
   * Optimize connection
   */
  private async optimizeConnection(): Promise<OptimizationResult | null> {
    const socket = socketService.getSocket();
    
    if (!socket || socket.connected) return null;

    const beforeState = {
      connected: socket.connected,
      timestamp: new Date()
    };

    // Attempt reconnection
    socketService.forceReconnect();

    // Wait a bit to see if connection improves
    await new Promise(resolve => setTimeout(resolve, 2000));

    const afterState = {
      connected: socket.connected,
      timestamp: new Date()
    };

    return {
      timestamp: new Date(),
      type: 'connection',
      before: beforeState,
      after: afterState,
      improvement: afterState.connected ? 1 : 0,
      success: afterState.connected
    };
  }

  /**
   * Optimize cache
   */
  private async optimizeCache(): Promise<OptimizationResult | null> {
    // Clear browser caches if available
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const beforeCount = cacheNames.length;
        
        // Clear old caches (keep only the latest)
        if (cacheNames.length > 3) {
          const oldCaches = cacheNames.slice(0, -2);
          await Promise.all(oldCaches.map(name => caches.delete(name)));
          
          const afterCacheNames = await caches.keys();
          const afterCount = afterCacheNames.length;
          
          return {
            timestamp: new Date(),
            type: 'cache',
            before: { cacheCount: beforeCount },
            after: { cacheCount: afterCount },
            improvement: beforeCount - afterCount,
            success: afterCount < beforeCount
          };
        }
      } catch (error) {
        this.log(`Cache optimization error: ${error}`);
      }
    }

    return null;
  }

  /**
   * Perform garbage collection
   */
  private async performGarbageCollection(): Promise<OptimizationResult | null> {
    if (!(window as any).gc || !('memory' in performance)) return null;

    const beforeMemory = (performance as any).memory;
    const beforeUsed = beforeMemory.usedJSHeapSize;

    // Force garbage collection
    (window as any).gc();

    // Wait a bit for GC to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const afterMemory = (performance as any).memory;
    const afterUsed = afterMemory.usedJSHeapSize;

    const improvement = beforeUsed - afterUsed;

    return {
      timestamp: new Date(),
      type: 'gc',
      before: { heapUsed: beforeUsed },
      after: { heapUsed: afterUsed },
      improvement: improvement / 1024 / 1024, // Convert to MB
      success: improvement > 0
    };
  }

  /**
   * Setup performance event listeners
   */
  private setupPerformanceListeners(): void {
    // Listen for memory pressure
    if ('memory' in performance) {
      const checkMemoryPressure = () => {
        const memory = (performance as any).memory;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (usagePercent > 85) {
          this.log('Memory pressure detected, performing emergency optimization');
          this.performOptimization();
        }
      };

      setInterval(checkMemoryPressure, 10000); // Check every 10 seconds
    }

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden, good time to optimize
        setTimeout(() => {
          if (document.hidden) {
            this.performOptimization();
          }
        }, 5000);
      }
    });
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    const totalOptimizations = this.optimizationHistory.length;
    const successfulOptimizations = this.optimizationHistory.filter(r => r.success).length;
    const successRate = totalOptimizations > 0 ? (successfulOptimizations / totalOptimizations) * 100 : 0;

    const byType = this.optimizationHistory.reduce((acc, result) => {
      acc[result.type] = (acc[result.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOptimizations,
      successfulOptimizations,
      successRate,
      byType,
      lastOptimization: this.optimizationHistory[this.optimizationHistory.length - 1]?.timestamp,
      isAutoOptimizing: !!this.optimizationTimer,
      isCurrentlyOptimizing: this.isOptimizing
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enableAutoCleanup !== undefined) {
      if (newConfig.enableAutoCleanup) {
        this.startAutoOptimization();
      } else {
        this.stopAutoOptimization();
      }
    }
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): OptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Clear optimization history
   */
  clearHistory(): void {
    this.optimizationHistory = [];
  }

  /**
   * Destroy optimizer
   */
  destroy(): void {
    this.stopAutoOptimization();
    this.clearHistory();
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[PerformanceOptimizer] ${message}`);
    }
  }
}

// Create singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Export types
export type { OptimizationConfig, OptimizationResult };
