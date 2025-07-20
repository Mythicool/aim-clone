interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

interface RetryableOperation<T> {
  id: string;
  operation: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onFailure?: (error: Error) => void;
  onRetry?: (attempt: number, error: Error) => void;
  options: RetryOptions;
  attempts: number;
  lastError?: Error;
}

export class RetryService {
  private static instance: RetryService;
  private operations: Map<string, RetryableOperation<any>> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  public static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService();
    }
    return RetryService.instance;
  }

  /**
   * Add an operation to be retried on failure
   */
  public addOperation<T>(
    id: string,
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    callbacks: {
      onSuccess?: (result: T) => void;
      onFailure?: (error: Error) => void;
      onRetry?: (attempt: number, error: Error) => void;
    } = {}
  ): void {
    const defaultOptions: RetryOptions = {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 10000
    };

    const retryableOperation: RetryableOperation<T> = {
      id,
      operation,
      onSuccess: callbacks.onSuccess,
      onFailure: callbacks.onFailure,
      onRetry: callbacks.onRetry,
      options: { ...defaultOptions, ...options },
      attempts: 0
    };

    this.operations.set(id, retryableOperation);
    this.executeOperation(id);
  }

  /**
   * Cancel a retry operation
   */
  public cancelOperation(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.operations.delete(id);
  }

  /**
   * Retry a specific operation immediately
   */
  public retryOperation(id: string): void {
    const operation = this.operations.get(id);
    if (operation) {
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
      this.executeOperation(id);
    }
  }

  /**
   * Get the status of all operations
   */
  public getOperationStatus(): Array<{
    id: string;
    attempts: number;
    maxAttempts: number;
    lastError?: string;
  }> {
    return Array.from(this.operations.values()).map(op => ({
      id: op.id,
      attempts: op.attempts,
      maxAttempts: op.options.maxAttempts,
      lastError: op.lastError?.message
    }));
  }

  private async executeOperation(id: string): Promise<void> {
    const operation = this.operations.get(id);
    if (!operation) return;

    operation.attempts++;

    try {
      const result = await operation.operation();
      
      // Success - clean up and call success callback
      this.operations.delete(id);
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
      
      if (operation.onSuccess) {
        operation.onSuccess(result);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      operation.lastError = err;

      if (operation.attempts >= operation.options.maxAttempts) {
        // Max attempts reached - give up
        this.operations.delete(id);
        const timer = this.timers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(id);
        }
        
        if (operation.onFailure) {
          operation.onFailure(err);
        }
      } else {
        // Schedule retry
        if (operation.onRetry) {
          operation.onRetry(operation.attempts, err);
        }

        const delay = Math.min(
          operation.options.delayMs * Math.pow(operation.options.backoffMultiplier, operation.attempts - 1),
          operation.options.maxDelayMs
        );

        const timer = setTimeout(() => {
          this.timers.delete(id);
          this.executeOperation(id);
        }, delay);

        this.timers.set(id, timer);
      }
    }
  }

  /**
   * Clear all operations and timers
   */
  public clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.operations.clear();
  }
}

// Export singleton instance
export const retryService = RetryService.getInstance();
