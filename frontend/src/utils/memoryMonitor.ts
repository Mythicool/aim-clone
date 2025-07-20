interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

interface MemoryThresholds {
  warning: number; // Percentage of heap limit
  critical: number; // Percentage of heap limit
  maxHistorySize: number; // Max number of history entries to keep
}

interface MemoryMonitorOptions {
  interval?: number; // Monitoring interval in ms
  thresholds?: Partial<MemoryThresholds>;
  enableLogging?: boolean;
  enableAlerts?: boolean;
}

class MemoryMonitor {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private memoryHistory: MemoryStats[] = [];
  private eventListeners: Map<string, Set<Function>> = new Map();
  
  private options: Required<MemoryMonitorOptions> = {
    interval: 30000, // 30 seconds
    thresholds: {
      warning: 70, // 70% of heap limit
      critical: 85, // 85% of heap limit
      maxHistorySize: 100
    },
    enableLogging: true,
    enableAlerts: true
  };

  constructor(options?: MemoryMonitorOptions) {
    if (options) {
      this.options = {
        ...this.options,
        ...options,
        thresholds: { ...this.options.thresholds, ...options.thresholds }
      };
    }
  }

  /**
   * Start monitoring memory usage
   */
  start(): void {
    if (this.isMonitoring) {
      console.warn('Memory monitor is already running');
      return;
    }

    if (!this.isMemoryAPIAvailable()) {
      console.warn('Memory API not available in this browser');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.interval);

    // Initial check
    this.checkMemoryUsage();

    if (this.options.enableLogging) {
      console.log('Memory monitoring started');
    }
  }

  /**
   * Stop monitoring memory usage
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.options.enableLogging) {
      console.log('Memory monitoring stopped');
    }
  }

  /**
   * Get current memory statistics
   */
  getCurrentStats(): MemoryStats | null {
    if (!this.isMemoryAPIAvailable()) return null;

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };
  }

  /**
   * Get memory usage history
   */
  getHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  /**
   * Get memory usage percentage
   */
  getUsagePercentage(): number {
    const stats = this.getCurrentStats();
    if (!stats) return 0;

    return (stats.usedJSHeapSize / stats.jsHeapSizeLimit) * 100;
  }

  /**
   * Check if memory usage is above threshold
   */
  isAboveThreshold(threshold: 'warning' | 'critical'): boolean {
    const percentage = this.getUsagePercentage();
    return percentage > this.options.thresholds[threshold];
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    if ((window as any).gc) {
      try {
        (window as any).gc();
        if (this.options.enableLogging) {
          console.log('Forced garbage collection');
        }
        return true;
      } catch (error) {
        console.error('Failed to force garbage collection:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get memory usage trend (increasing/decreasing/stable)
   */
  getTrend(): 'increasing' | 'decreasing' | 'stable' | 'unknown' {
    if (this.memoryHistory.length < 3) return 'unknown';

    const recent = this.memoryHistory.slice(-3);
    const first = recent[0].usedJSHeapSize;
    const last = recent[recent.length - 1].usedJSHeapSize;
    const diff = last - first;
    const threshold = first * 0.05; // 5% threshold

    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * Get formatted memory size
   */
  formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get memory report
   */
  getReport(): {
    current: MemoryStats | null;
    percentage: number;
    trend: string;
    warnings: string[];
    recommendations: string[];
  } {
    const current = this.getCurrentStats();
    const percentage = this.getUsagePercentage();
    const trend = this.getTrend();
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (this.isAboveThreshold('critical')) {
      warnings.push('Critical memory usage detected');
      recommendations.push('Consider closing unused chat windows');
      recommendations.push('Clear message history for old conversations');
    } else if (this.isAboveThreshold('warning')) {
      warnings.push('High memory usage detected');
      recommendations.push('Monitor memory usage closely');
    }

    if (trend === 'increasing') {
      warnings.push('Memory usage is trending upward');
      recommendations.push('Check for potential memory leaks');
    }

    return {
      current,
      percentage,
      trend,
      warnings,
      recommendations
    };
  }

  /**
   * Check memory usage and emit events
   */
  private checkMemoryUsage(): void {
    const stats = this.getCurrentStats();
    if (!stats) return;

    // Add to history
    this.memoryHistory.push(stats);
    
    // Trim history if too large
    if (this.memoryHistory.length > this.options.thresholds.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.options.thresholds.maxHistorySize);
    }

    const percentage = (stats.usedJSHeapSize / stats.jsHeapSizeLimit) * 100;

    // Check thresholds and emit events
    if (percentage > this.options.thresholds.critical) {
      this.emit('memory:critical', { stats, percentage });
      
      if (this.options.enableAlerts) {
        console.error(`Critical memory usage: ${percentage.toFixed(1)}%`);
      }
    } else if (percentage > this.options.thresholds.warning) {
      this.emit('memory:warning', { stats, percentage });
      
      if (this.options.enableLogging) {
        console.warn(`High memory usage: ${percentage.toFixed(1)}%`);
      }
    }

    this.emit('memory:update', { stats, percentage });
  }

  /**
   * Check if Memory API is available
   */
  private isMemoryAPIAvailable(): boolean {
    return !!(performance as any).memory;
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
    this.stop();
    this.eventListeners.clear();
    this.memoryHistory = [];
  }
}

// Global instance
export const memoryMonitor = new MemoryMonitor({
  interval: 30000, // Check every 30 seconds
  thresholds: {
    warning: 70,
    critical: 85,
    maxHistorySize: 50
  },
  enableLogging: process.env.NODE_ENV === 'development',
  enableAlerts: true
});

// Auto-start in development
if (process.env.NODE_ENV === 'development') {
  memoryMonitor.start();
}
