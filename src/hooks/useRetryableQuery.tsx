
import { useState } from 'react';

export const useRetryableQuery = () => {
  const [retryCount, setRetryCount] = useState(0);

  const executeWithRetry = async <T,>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 2
  ): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 0) {
          console.log(`${operationName} succeeded on attempt ${attempt + 1}`);
        }
        setRetryCount(0);
        return result;
      } catch (error) {
        lastError = error;
        console.error(`${operationName} failed on attempt ${attempt + 1}:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`Retrying ${operationName} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          setRetryCount(attempt + 1);
        }
      }
    }
    
    setRetryCount(0);
    throw lastError;
  };

  return {
    executeWithRetry,
    retryCount
  };
};
