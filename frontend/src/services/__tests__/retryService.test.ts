import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryService } from '../retryService';

describe('RetryService', () => {
  let retryService: RetryService;

  beforeEach(() => {
    retryService = RetryService.getInstance();
    retryService.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    retryService.clear();
    vi.useRealTimers();
  });

  it('should execute operation successfully on first attempt', async () => {
    const mockOperation = vi.fn().mockResolvedValue('success');
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    retryService.addOperation('test-op', mockOperation, {}, {
      onSuccess,
      onFailure
    });

    // Wait for operation to complete
    await vi.runAllTimersAsync();

    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('success');
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('should retry operation on failure', async () => {
    const mockOperation = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');
    
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const onRetry = vi.fn();

    retryService.addOperation('test-op', mockOperation, {
      maxAttempts: 3,
      delayMs: 1000
    }, {
      onSuccess,
      onFailure,
      onRetry
    });

    // Wait for all retries to complete
    await vi.runAllTimersAsync();

    expect(mockOperation).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith('success');
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('should give up after max attempts', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('Always fails'));
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const onRetry = vi.fn();

    retryService.addOperation('test-op', mockOperation, {
      maxAttempts: 2,
      delayMs: 1000
    }, {
      onSuccess,
      onFailure,
      onRetry
    });

    // Wait for all retries to complete
    await vi.runAllTimersAsync();

    expect(mockOperation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should use exponential backoff for retry delays', async () => {
    const mockOperation = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    retryService.addOperation('test-op', mockOperation, {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2
    });

    // First attempt should happen immediately
    expect(mockOperation).toHaveBeenCalledTimes(1);

    // First retry after 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockOperation).toHaveBeenCalledTimes(2);

    // Second retry after 2000ms (1000 * 2^1)
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  it('should cancel operation', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('Failure'));
    const onFailure = vi.fn();

    retryService.addOperation('test-op', mockOperation, {
      maxAttempts: 3,
      delayMs: 1000
    }, {
      onFailure
    });

    // First attempt fails
    expect(mockOperation).toHaveBeenCalledTimes(1);

    // Cancel before retry
    retryService.cancelOperation('test-op');

    // Wait for retry time to pass
    await vi.advanceTimersByTimeAsync(2000);

    // Should not have retried
    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('should retry operation immediately when requested', async () => {
    const mockOperation = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    const onSuccess = vi.fn();

    retryService.addOperation('test-op', mockOperation, {
      maxAttempts: 3,
      delayMs: 5000 // Long delay
    }, {
      onSuccess
    });

    // Wait for first attempt to complete
    await vi.runAllTimersAsync();

    // First attempt fails
    expect(mockOperation).toHaveBeenCalledTimes(1);

    // Manually retry immediately
    retryService.retryOperation('test-op');

    // Wait for retry to complete
    await vi.runAllTimersAsync();

    // Should succeed immediately without waiting for delay
    expect(mockOperation).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith('success');
  });

  it('should provide operation status', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));

    retryService.addOperation('test-op', mockOperation, {
      maxAttempts: 3,
      delayMs: 1000
    });

    // Wait for first attempt to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check status after first failure
    const status = retryService.getOperationStatus();
    expect(status).toHaveLength(1);
    expect(status[0]).toEqual({
      id: 'test-op',
      attempts: 1,
      maxAttempts: 3,
      lastError: 'Test error'
    });
  });

  it('should respect max delay limit', async () => {
    const mockOperation = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    retryService.addOperation('test-op', mockOperation, {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 10,
      maxDelayMs: 1500
    });

    // First attempt fails
    expect(mockOperation).toHaveBeenCalledTimes(1);

    // First retry after 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockOperation).toHaveBeenCalledTimes(2);

    // Second retry should be capped at maxDelayMs (1500ms) instead of 10000ms
    await vi.advanceTimersByTimeAsync(1500);
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });
});
