import { retryService } from './retryService';

export interface NetworkError {
  type: 'network' | 'timeout' | 'server' | 'validation' | 'authentication' | 'unknown';
  message: string;
  statusCode?: number;
  retryable: boolean;
  details?: any;
}

export interface NetworkErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: number;
  showUserFeedback?: boolean;
  onError?: (error: NetworkError) => void;
  onRetry?: (attempt: number, error: NetworkError) => void;
  onSuccess?: () => void;
}

export class NetworkErrorHandler {
  private static instance: NetworkErrorHandler;
  private errorListeners: ((error: NetworkError) => void)[] = [];

  private constructor() {}

  public static getInstance(): NetworkErrorHandler {
    if (!NetworkErrorHandler.instance) {
      NetworkErrorHandler.instance = new NetworkErrorHandler();
    }
    return NetworkErrorHandler.instance;
  }

  /**
   * Classifies an error and returns a NetworkError object
   */
  public classifyError(error: any): NetworkError {
    // Handle null/undefined errors
    if (!error) {
      return {
        type: 'unknown',
        message: 'An unexpected error occurred.',
        retryable: false
      };
    }

    // Network connectivity issues (only check if navigator is available)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        type: 'network',
        message: 'No internet connection. Please check your network and try again.',
        retryable: true
      };
    }

    // Fetch API errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Unable to connect to server. Please check your connection.',
        retryable: true
      };
    }

    // HTTP Response errors
    if (error.response) {
      const status = error.response.status;
      
      if (status >= 500) {
        return {
          type: 'server',
          message: 'Server error occurred. Please try again later.',
          statusCode: status,
          retryable: true,
          details: error.response.data
        };
      }
      
      if (status === 401) {
        return {
          type: 'authentication',
          message: 'Authentication failed. Please log in again.',
          statusCode: status,
          retryable: false,
          details: error.response.data
        };
      }
      
      if (status === 403) {
        return {
          type: 'authentication',
          message: 'Access denied. You do not have permission to perform this action.',
          statusCode: status,
          retryable: false,
          details: error.response.data
        };
      }
      
      if (status === 400) {
        return {
          type: 'validation',
          message: error.response.data?.error?.message || 'Invalid request data.',
          statusCode: status,
          retryable: false,
          details: error.response.data
        };
      }
      
      if (status === 404) {
        return {
          type: 'server',
          message: 'Requested resource not found.',
          statusCode: status,
          retryable: false,
          details: error.response.data
        };
      }
      
      if (status === 429) {
        return {
          type: 'server',
          message: 'Too many requests. Please wait a moment and try again.',
          statusCode: status,
          retryable: true,
          details: error.response.data
        };
      }
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        type: 'timeout',
        message: 'Request timed out. Please try again.',
        retryable: true
      };
    }

    // WebSocket errors
    if (error.type === 'websocket') {
      return {
        type: 'network',
        message: 'Real-time connection lost. Attempting to reconnect...',
        retryable: true
      };
    }

    // Generic error
    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred.',
      retryable: false,
      details: error
    };
  }

  /**
   * Handles an error with automatic retry logic
   */
  public async handleError<T>(
    operation: () => Promise<T>,
    options: NetworkErrorHandlerOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      showUserFeedback = true,
      onError,
      onRetry,
      onSuccess
    } = options;

    const operationId = `network_operation_${Date.now()}_${Math.random()}`;

    return new Promise((resolve, reject) => {
      retryService.addOperation(
        operationId,
        operation,
        {
          maxAttempts: maxRetries + 1,
          delayMs: retryDelay,
          backoffMultiplier: 1.5,
          maxDelayMs: 10000
        },
        {
          onSuccess: (result) => {
            if (onSuccess) onSuccess();
            resolve(result);
          },
          onFailure: (error) => {
            const networkError = this.classifyError(error);
            if (onError) onError(networkError);
            if (showUserFeedback) {
              this.notifyErrorListeners(networkError);
            }
            reject(networkError);
          },
          onRetry: (attempt, error) => {
            const networkError = this.classifyError(error);
            if (onRetry) onRetry(attempt, networkError);
            if (showUserFeedback && networkError.retryable) {
              this.notifyErrorListeners({
                ...networkError,
                message: `${networkError.message} (Retry ${attempt}/${maxRetries})`
              });
            }
          }
        }
      );
    });
  }

  /**
   * Handles a single network request with error classification
   */
  public async handleRequest<T>(
    request: () => Promise<T>,
    options: NetworkErrorHandlerOptions = {}
  ): Promise<T> {
    try {
      const result = await request();
      if (options.onSuccess) options.onSuccess();
      return result;
    } catch (error) {
      const networkError = this.classifyError(error);
      
      if (options.onError) {
        options.onError(networkError);
      }
      
      if (options.showUserFeedback !== false) {
        this.notifyErrorListeners(networkError);
      }
      
      throw networkError;
    }
  }

  /**
   * Adds a global error listener
   */
  public addErrorListener(listener: (error: NetworkError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Removes a global error listener
   */
  public removeErrorListener(listener: (error: NetworkError) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Notifies all error listeners
   */
  private notifyErrorListeners(error: NetworkError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }

  /**
   * Checks if the current error is retryable
   */
  public isRetryable(error: any): boolean {
    const networkError = this.classifyError(error);
    return networkError.retryable;
  }

  /**
   * Gets a user-friendly error message
   */
  public getUserMessage(error: any): string {
    const networkError = this.classifyError(error);
    return networkError.message;
  }

  /**
   * Creates a retry function for manual retries
   */
  public createRetryFunction<T>(
    operation: () => Promise<T>,
    options: NetworkErrorHandlerOptions = {}
  ): () => Promise<T> {
    return () => this.handleError(operation, options);
  }
}

// Export singleton instance
export const networkErrorHandler = NetworkErrorHandler.getInstance();

// Utility functions for common use cases
export async function withNetworkErrorHandling<T>(
  operation: () => Promise<T>,
  options?: NetworkErrorHandlerOptions
): Promise<T> {
  return networkErrorHandler.handleError(operation, options);
}

export async function withSimpleErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  return networkErrorHandler.handleRequest(operation, {
    showUserFeedback: true
  });
}

export function isNetworkError(error: any): error is NetworkError {
  return error && typeof error === 'object' && 'type' in error && 'retryable' in error;
}
