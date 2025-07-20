import { useEffect, useRef, useCallback, useMemo } from 'react';
import { socketService } from '../services/socket';
import { Socket } from 'socket.io-client';

interface SocketEventHandler {
  event: string;
  handler: (...args: any[]) => void;
  options?: {
    debounce?: number;
    throttle?: number;
    once?: boolean;
  };
}

interface UseOptimizedSocketOptions {
  autoConnect?: boolean;
  cleanupOnUnmount?: boolean;
  debounceDefaults?: {
    typing?: number;
    statusUpdate?: number;
    heartbeat?: number;
  };
}

/**
 * Optimized socket hook with automatic cleanup, debouncing, and memory leak prevention
 */
export const useOptimizedSocket = (
  eventHandlers: SocketEventHandler[] = [],
  options: UseOptimizedSocketOptions = {}
) => {
  const {
    autoConnect = true,
    cleanupOnUnmount = true,
    debounceDefaults = {
      typing: 300,
      statusUpdate: 1000,
      heartbeat: 30000
    }
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const eventHandlersRef = useRef<Map<string, Function>>(new Map());
  const debouncedHandlersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const throttledHandlersRef = useRef<Map<string, { lastCall: number; timeout?: NodeJS.Timeout }>>(new Map());

  // Debounce utility
  const createDebouncedHandler = useCallback((
    handler: Function,
    delay: number,
    key: string
  ) => {
    return (...args: any[]) => {
      const existingTimeout = debouncedHandlersRef.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        handler(...args);
        debouncedHandlersRef.current.delete(key);
      }, delay);

      debouncedHandlersRef.current.set(key, timeout);
    };
  }, []);

  // Throttle utility
  const createThrottledHandler = useCallback((
    handler: Function,
    delay: number,
    key: string
  ) => {
    return (...args: any[]) => {
      const now = Date.now();
      const throttleData = throttledHandlersRef.current.get(key);

      if (!throttleData || now - throttleData.lastCall >= delay) {
        handler(...args);
        throttledHandlersRef.current.set(key, { lastCall: now });
      } else if (!throttleData.timeout) {
        const remainingTime = delay - (now - throttleData.lastCall);
        const timeout = setTimeout(() => {
          handler(...args);
          const data = throttledHandlersRef.current.get(key);
          if (data) {
            data.lastCall = Date.now();
            data.timeout = undefined;
          }
        }, remainingTime);

        throttledHandlersRef.current.set(key, {
          ...throttleData,
          timeout
        });
      }
    };
  }, []);

  // Process event handlers with optimization
  const processedHandlers = useMemo(() => {
    return eventHandlers.map(({ event, handler, options = {} }) => {
      const key = `${event}_${Math.random()}`;
      let processedHandler = handler;

      // Apply debouncing
      if (options.debounce) {
        processedHandler = createDebouncedHandler(handler, options.debounce, key);
      }
      // Apply throttling (mutually exclusive with debouncing)
      else if (options.throttle) {
        processedHandler = createThrottledHandler(handler, options.throttle, key);
      }
      // Apply default debouncing for known events
      else if (event.includes('typing') && debounceDefaults.typing) {
        processedHandler = createDebouncedHandler(handler, debounceDefaults.typing, key);
      } else if (event.includes('status') && debounceDefaults.statusUpdate) {
        processedHandler = createDebouncedHandler(handler, debounceDefaults.statusUpdate, key);
      } else if (event === 'heartbeat' && debounceDefaults.heartbeat) {
        processedHandler = createThrottledHandler(handler, debounceDefaults.heartbeat, key);
      }

      return {
        event,
        handler: processedHandler,
        originalHandler: handler,
        key,
        once: options.once || false
      };
    });
  }, [eventHandlers, createDebouncedHandler, createThrottledHandler, debounceDefaults]);

  // Setup socket connection and event listeners
  useEffect(() => {
    if (!autoConnect) return;

    socketRef.current = socketService.getSocket();

    if (!socketRef.current) {
      console.warn('Socket not available. Make sure to connect first.');
      return;
    }

    // Register event handlers
    processedHandlers.forEach(({ event, handler, key, once }) => {
      if (socketRef.current) {
        if (once) {
          socketRef.current.once(event, handler);
        } else {
          socketRef.current.on(event, handler);
        }
        eventHandlersRef.current.set(key, handler);
      }
    });

    // Cleanup function
    return () => {
      if (socketRef.current) {
        processedHandlers.forEach(({ event, key }) => {
          const handler = eventHandlersRef.current.get(key);
          if (handler && socketRef.current) {
            socketRef.current.off(event, handler as any);
          }
          eventHandlersRef.current.delete(key);
        });
      }

      // Clear all debounced timeouts
      debouncedHandlersRef.current.forEach(timeout => clearTimeout(timeout));
      debouncedHandlersRef.current.clear();

      // Clear all throttled timeouts
      throttledHandlersRef.current.forEach(data => {
        if (data.timeout) clearTimeout(data.timeout);
      });
      throttledHandlersRef.current.clear();
    };
  }, [processedHandlers, autoConnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupOnUnmount) {
        // Clear all pending timeouts
        debouncedHandlersRef.current.forEach(timeout => clearTimeout(timeout));
        debouncedHandlersRef.current.clear();

        throttledHandlersRef.current.forEach(data => {
          if (data.timeout) clearTimeout(data.timeout);
        });
        throttledHandlersRef.current.clear();

        // Remove all event listeners
        eventHandlersRef.current.clear();
      }
    };
  }, [cleanupOnUnmount]);

  // Emit event with automatic error handling
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      try {
        socketRef.current.emit(event, data);
        return true;
      } catch (error) {
        console.error(`Failed to emit event ${event}:`, error);
        return false;
      }
    } else {
      console.warn(`Cannot emit ${event}: socket not connected`);
      return false;
    }
  }, []);

  // Emit with acknowledgment and timeout
  const emitWithAck = useCallback((
    event: string, 
    data?: any, 
    timeout: number = 5000
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Acknowledgment timeout for event: ${event}`));
      }, timeout);

      try {
        socketRef.current.emit(event, data, (response: any) => {
          clearTimeout(timer);
          resolve(response);
        });
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }, []);

  // Get connection status
  const isConnected = useCallback(() => {
    return socketRef.current?.connected || false;
  }, []);

  // Force cleanup (useful for manual cleanup)
  const cleanup = useCallback(() => {
    debouncedHandlersRef.current.forEach(timeout => clearTimeout(timeout));
    debouncedHandlersRef.current.clear();

    throttledHandlersRef.current.forEach(data => {
      if (data.timeout) clearTimeout(data.timeout);
    });
    throttledHandlersRef.current.clear();

    if (socketRef.current) {
      eventHandlersRef.current.forEach((handler, key) => {
        const eventName = processedHandlers.find(h => h.key === key)?.event;
        if (eventName && socketRef.current) {
          socketRef.current.off(eventName, handler as any);
        }
      });
    }

    eventHandlersRef.current.clear();
  }, [processedHandlers]);

  return {
    socket: socketRef.current,
    emit,
    emitWithAck,
    isConnected,
    cleanup
  };
};
