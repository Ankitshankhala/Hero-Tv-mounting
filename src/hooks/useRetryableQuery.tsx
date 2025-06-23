
import { useState, useCallback } from 'react';
import { useErrorMonitoring } from './useErrorMonitoring';

interface RetryConfig {
  maxRetries?: number;
  delay?: number;
  backoffMultiplier?: number;
}

export const useRetryableQuery = () => {
  const [retryCount, setRetryCount] = useState(0);
  const { logError } = useErrorMonitoring();

  const executeWithRetry = useCallback(async (
    operation: () => Promise<any>,
    operationName: string,
    config: RetryConfig = {}
  ): Promise<any> => {
    const {
      maxRetries = 3,
      delay = 1000,
      backoffMultiplier = 2
    } = config;

    let currentDelay = delay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 0) {
          console.log(`${operationName} succeeded on retry ${attempt}`);
        }
        setRetryCount(0); // Reset on success
        return result;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        
        if (isLastAttempt) {
          logError(error as Error, `${operationName} failed after ${maxRetries + 1} attempts`, {
            category: 'retry',
            operationName,
            finalAttempt: attempt + 1,
            totalAttempts: maxRetries + 1
          });
          setRetryCount(0); // Reset after final failure
          throw error;
        }

        console.warn(`${operationName} failed on attempt ${attempt + 1}, retrying in ${currentDelay}ms...`);
        setRetryCount(attempt + 1);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= backoffMultiplier;
      }
    }

    throw new Error('Unexpected end of retry loop');
  }, [logError]);

  const retryWithExponentialBackoff = useCallback(async (
    operationName: string,
    operation: () => Promise<any>
  ): Promise<any> => {
    return executeWithRetry(operation, operationName, {
      maxRetries: 3,
      delay: 1000,
      backoffMultiplier: 2
    });
  }, [executeWithRetry]);

  return {
    executeWithRetry,
    retryWithExponentialBackoff,
    retryCount
  };
};
