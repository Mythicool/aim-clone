import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkErrorHandler, networkErrorHandler } from '../networkErrorHandler';

describe('NetworkErrorHandler', () => {
  let handler: NetworkErrorHandler;

  beforeEach(() => {
    handler = NetworkErrorHandler.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('classifyError', () => {
    it('should classify network connectivity errors', () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const error = handler.classifyError(new Error('Network error'));
      
      expect(error.type).toBe('network');
      expect(error.message).toContain('No internet connection');
      expect(error.retryable).toBe(true);
    });

    it('should classify fetch errors', () => {
      const fetchError = new TypeError('Failed to fetch');
      const error = handler.classifyError(fetchError);
      
      expect(error.type).toBe('network');
      expect(error.message).toContain('Unable to connect to server');
      expect(error.retryable).toBe(true);
    });

    it('should classify server errors (5xx)', () => {
      const serverError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        }
      };
      
      const error = handler.classifyError(serverError);
      
      expect(error.type).toBe('server');
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });

    it('should classify authentication errors (401)', () => {
      const authError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      
      const error = handler.classifyError(authError);
      
      expect(error.type).toBe('authentication');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });

    it('should classify validation errors (400)', () => {
      const validationError = {
        response: {
          status: 400,
          data: { 
            error: { 
              message: 'Validation failed',
              details: { screenName: 'Required' }
            }
          }
        }
      };
      
      const error = handler.classifyError(validationError);
      
      expect(error.type).toBe('validation');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.message).toBe('Validation failed');
    });

    it('should classify timeout errors', () => {
      const timeoutError = { code: 'ECONNABORTED' };
      const error = handler.classifyError(timeoutError);
      
      expect(error.type).toBe('timeout');
      expect(error.retryable).toBe(true);
    });

    it('should classify rate limiting errors (429)', () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: { message: 'Too many requests' }
        }
      };
      
      const error = handler.classifyError(rateLimitError);
      
      expect(error.type).toBe('server');
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
    });

    it('should classify unknown errors', () => {
      const unknownError = new Error('Something went wrong');
      const error = handler.classifyError(unknownError);
      
      expect(error.type).toBe('unknown');
      expect(error.retryable).toBe(false);
      expect(error.message).toBe('Something went wrong');
    });
  });

  describe('handleRequest', () => {
    it('should handle successful requests', async () => {
      const mockRequest = vi.fn().mockResolvedValue('success');
      const onSuccess = vi.fn();
      
      const result = await handler.handleRequest(mockRequest, { onSuccess });
      
      expect(result).toBe('success');
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should handle failed requests with error callback', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Request failed'));
      const onError = vi.fn();
      
      await expect(
        handler.handleRequest(mockRequest, { onError, showUserFeedback: false })
      ).rejects.toThrow();
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unknown',
          message: 'Request failed'
        })
      );
    });
  });

  describe('error listeners', () => {
    it('should add and notify error listeners', async () => {
      const listener = vi.fn();
      handler.addErrorListener(listener);
      
      const mockRequest = vi.fn().mockRejectedValue(new Error('Test error'));
      
      try {
        await handler.handleRequest(mockRequest);
      } catch (e) {
        // Expected to throw
      }
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unknown',
          message: 'Test error'
        })
      );
    });

    it('should remove error listeners', async () => {
      const listener = vi.fn();
      handler.addErrorListener(listener);
      handler.removeErrorListener(listener);
      
      const mockRequest = vi.fn().mockRejectedValue(new Error('Test error'));
      
      try {
        await handler.handleRequest(mockRequest);
      } catch (e) {
        // Expected to throw
      }
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should check if error is retryable', () => {
      const retryableError = {
        response: { status: 500 }
      };
      
      const nonRetryableError = {
        response: { status: 400 }
      };
      
      expect(handler.isRetryable(retryableError)).toBe(true);
      expect(handler.isRetryable(nonRetryableError)).toBe(false);
    });

    it('should get user-friendly error messages', () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };
      
      const message = handler.getUserMessage(error);
      expect(message).toContain('Authentication failed');
    });

    it('should create retry functions', () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const retryFn = handler.createRetryFunction(mockOperation);
      
      expect(typeof retryFn).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined errors gracefully', () => {
      const nullError = handler.classifyError(null);
      const undefinedError = handler.classifyError(undefined);
      
      expect(nullError.type).toBe('unknown');
      expect(undefinedError.type).toBe('unknown');
    });

    it('should handle errors without response objects', () => {
      const error = { message: 'No response object' };
      const classified = handler.classifyError(error);
      
      expect(classified.type).toBe('unknown');
      expect(classified.message).toBe('No response object');
    });

    it('should handle errors with malformed response data', () => {
      const malformedError = {
        response: {
          status: 400,
          data: null
        }
      };
      
      const error = handler.classifyError(malformedError);
      expect(error.type).toBe('validation');
      expect(error.message).toBe('Invalid request data.');
    });
  });

  describe('network status detection', () => {
    it('should detect online status', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      const error = handler.classifyError(new Error('Some error'));
      expect(error.type).not.toBe('network');
    });

    it('should detect offline status', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const error = handler.classifyError(new Error('Some error'));
      expect(error.type).toBe('network');
      expect(error.message).toContain('No internet connection');
    });
  });
});
