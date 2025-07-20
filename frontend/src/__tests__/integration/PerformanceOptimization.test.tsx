/**
 * Integration tests for performance optimization features
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { memoryManager } from '../../services/memoryManager';
import { performanceOptimizer } from '../../utils/performanceOptimizer';
import { socketService } from '../../services/socket';
import { PerformanceMonitor } from '../../components/debug/PerformanceMonitor';
import { MemoryMonitor } from '../../components/debug/MemoryMonitor';
import { ConnectionStatus } from '../../components/connection/ConnectionStatus';
import { OfflineBanner } from '../../components/connection/OfflineBanner';

// Mock socket service
jest.mock('../../services/socket', () => ({
  socketService: {
    getSocket: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    forceReconnect: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  }
}));

// Mock performance API
const mockPerformance = {
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
  },
  now: jest.fn(() => Date.now())
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

// Mock window.gc
Object.defineProperty(global.window, 'gc', {
  value: jest.fn(),
  writable: true
});

describe('Performance Optimization Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    memoryManager.clearAll();
    performanceOptimizer.clearHistory();
  });

  afterEach(() => {
    performanceOptimizer.stopAutoOptimization();
  });

  describe('Memory Management', () => {
    it('should manage conversation memory efficiently', async () => {
      // Simulate adding many messages to memory
      const conversationId = 'test-conversation';
      const messages = Array.from({ length: 1500 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Test message ${i}`,
        timestamp: new Date(),
        fromUserId: 'user1',
        toUserId: 'user2'
      }));

      // Register conversation with memory manager
      memoryManager.registerConversation(conversationId, messages);

      // Check initial state
      const initialStats = memoryManager.getMemoryStats();
      expect(initialStats.messagesInMemory).toBe(1500);

      // Trigger cleanup
      const cleanupStats = memoryManager.performCleanup();
      expect(cleanupStats.messagesInMemory).toBeLessThan(1500);
    });

    it('should clean up event listeners properly', () => {
      const component = 'TestComponent';
      const event = 'test-event';
      const listener = jest.fn();

      // Register event listener
      memoryManager.registerEventListener(component, event, listener);

      let stats = memoryManager.getMemoryStats();
      expect(stats.activeEventListeners).toBe(1);

      // Unregister event listener
      memoryManager.unregisterEventListener(component, event, listener);

      stats = memoryManager.getMemoryStats();
      expect(stats.activeEventListeners).toBe(0);
    });

    it('should handle memory pressure correctly', async () => {
      // Simulate high memory usage
      mockPerformance.memory.usedJSHeapSize = 180 * 1024 * 1024; // 180MB (90% of limit)

      // Start auto-optimization
      performanceOptimizer.startAutoOptimization();

      // Wait for optimization to trigger
      await waitFor(() => {
        const stats = performanceOptimizer.getOptimizationStats();
        expect(stats.totalOptimizations).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Check that garbage collection was called
      expect(window.gc).toHaveBeenCalled();
    });
  });

  describe('Connection Optimization', () => {
    it('should handle connection failures gracefully', async () => {
      const mockSocket = {
        connected: false,
        connect: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      };

      (socketService.getSocket as jest.Mock).mockReturnValue(mockSocket);

      render(<ConnectionStatus isVisible={true} />);

      // Simulate connection loss
      act(() => {
        const connectionLostHandler = (socketService.on as jest.Mock).mock.calls
          .find(call => call[0] === 'connection:lost')?.[1];
        if (connectionLostHandler) {
          connectionLostHandler({ reason: 'network error' });
        }
      });

      // Should show disconnected state
      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
      });
    });

    it('should show offline banner when network is unavailable', async () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      render(<OfflineBanner />);

      // Trigger offline event
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(screen.getByText(/no internet connection/i)).toBeInTheDocument();
      });
    });

    it('should attempt reconnection when coming back online', async () => {
      const mockSocket = {
        connected: false,
        connect: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      };

      (socketService.getSocket as jest.Mock).mockReturnValue(mockSocket);
      (socketService.forceReconnect as jest.Mock).mockImplementation(() => {
        mockSocket.connected = true;
      });

      render(<OfflineBanner />);

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(socketService.forceReconnect).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should display performance metrics correctly', async () => {
      render(<PerformanceMonitor isVisible={true} />);

      await waitFor(() => {
        expect(screen.getByText(/performance/i)).toBeInTheDocument();
      });

      // Click to expand
      const header = screen.getByText(/performance/i).closest('.monitor-header');
      if (header) {
        await userEvent.click(header);
      }

      // Should show metrics
      await waitFor(() => {
        expect(screen.getByText(/fps/i)).toBeInTheDocument();
        expect(screen.getByText(/memory/i)).toBeInTheDocument();
        expect(screen.getByText(/connection/i)).toBeInTheDocument();
      });
    });

    it('should show memory monitor with current stats', async () => {
      // Add some test data to memory manager
      memoryManager.registerConversation('test', [
        { id: '1', content: 'test', timestamp: new Date(), fromUserId: 'u1', toUserId: 'u2' }
      ]);

      render(<MemoryMonitor isVisible={true} />);

      await waitFor(() => {
        expect(screen.getByText(/memory monitor/i)).toBeInTheDocument();
      });

      // Expand the monitor
      const header = screen.getByText(/memory monitor/i).closest('.memory-monitor__header');
      if (header) {
        await userEvent.click(header);
      }

      // Should show memory stats
      await waitFor(() => {
        expect(screen.getByText(/messages/i)).toBeInTheDocument();
        expect(screen.getByText(/event listeners/i)).toBeInTheDocument();
      });
    });

    it('should trigger cleanup when cleanup button is clicked', async () => {
      const cleanupSpy = jest.spyOn(memoryManager, 'performCleanup');

      render(<MemoryMonitor isVisible={true} />);

      // Expand the monitor
      const header = screen.getByText(/memory monitor/i).closest('.memory-monitor__header');
      if (header) {
        await userEvent.click(header);
      }

      // Click cleanup button
      const cleanupButton = await screen.findByText(/cleanup/i);
      await userEvent.click(cleanupButton);

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Auto-Optimization', () => {
    it('should perform automatic optimization when thresholds are exceeded', async () => {
      // Configure optimizer with low thresholds for testing
      performanceOptimizer.updateConfig({
        enableAutoCleanup: true,
        messageThreshold: 5,
        optimizationInterval: 100 // 100ms for fast testing
      });

      // Add messages that exceed threshold
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Test message ${i}`,
        timestamp: new Date(),
        fromUserId: 'user1',
        toUserId: 'user2'
      }));

      memoryManager.registerConversation('test-conversation', messages);

      // Start auto-optimization
      performanceOptimizer.startAutoOptimization();

      // Wait for optimization to occur
      await waitFor(() => {
        const stats = performanceOptimizer.getOptimizationStats();
        expect(stats.totalOptimizations).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // Check that memory was optimized
      const memoryStats = memoryManager.getMemoryStats();
      expect(memoryStats.messagesInMemory).toBeLessThanOrEqual(5);
    });

    it('should export optimization metrics', async () => {
      // Perform some optimizations
      await performanceOptimizer.performOptimization();

      const stats = performanceOptimizer.getOptimizationStats();
      expect(stats).toHaveProperty('totalOptimizations');
      expect(stats).toHaveProperty('successfulOptimizations');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('byType');
    });
  });

  describe('Error Handling', () => {
    it('should handle optimization errors gracefully', async () => {
      // Mock an error in memory manager
      const originalCleanup = memoryManager.performCleanup;
      memoryManager.performCleanup = jest.fn(() => {
        throw new Error('Test error');
      });

      // Should not crash when optimization fails
      await expect(performanceOptimizer.performOptimization()).resolves.not.toThrow();

      // Restore original method
      memoryManager.performCleanup = originalCleanup;
    });

    it('should handle missing performance APIs gracefully', () => {
      // Remove performance.memory
      const originalMemory = (performance as any).memory;
      delete (performance as any).memory;

      // Should not crash
      expect(() => {
        memoryManager.getMemoryStats();
      }).not.toThrow();

      // Restore
      (performance as any).memory = originalMemory;
    });
  });
});
