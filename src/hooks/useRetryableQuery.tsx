
import { useState, useCallback } from 'react';
import { useErrorMonitoring } from './useErrorMonitoring';

interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
}

export const useRetryableQuery = (config: RetryConfig = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 10000
  } = config;

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { logError } = useErrorMonitoring();

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> => {
    const actualMaxRetries = customConfig?.maxRetries ?? maxRetries;
    let attempt = 0;
    let lastError: Error;

    while (attempt <= actualMaxRetries) {
      try {
        if (attempt > 0) {
          setIsRetrying(true);
          const delayMs = Math.min(
            initialDelay * Math.pow(backoffMultiplier, attempt - 1),
            maxDelay
          );
          console.log(`Retrying ${context} (attempt ${attempt}/${actualMaxRetries}) after ${delayMs}ms delay`);
          await delay(delayMs);
        }

        const result = await operation();
        
        if (attempt > 0) {
          console.log(`${context} succeeded on retry attempt ${attempt}`);
          setRetryCount(prev => prev + attempt);
        }
        
        setIsRetrying(false);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        logError(lastError, `${context} - Attempt ${attempt}`, {
          attempt,
          maxRetries: actualMaxRetries,
          willRetry: attempt <= actualMaxRetries
        });

        if (attempt > actualMaxRetries) {
          setIsRetrying(false);
          logError(lastError, `${context} - All retries exhausted`, {
            totalAttempts: attempt,
            maxRetries: actualMaxRetries
          });
          throw lastError;
        }
      }
    }

    throw lastError!;
  }, [maxRetries, initialDelay, backoffMultiplier, maxDelay, logError]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    executeWithRetry,
    retryCount,
    isRetrying,
    reset
  };
};
