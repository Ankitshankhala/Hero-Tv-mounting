
import { useState, useCallback } from 'react';
import { useErrorHandler } from './useErrorHandler';

interface RetryableQueryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: any) => void;
}

export const useRetryableQuery = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleError } = useErrorHandler();

  const executeWithRetry = useCallback(async (
    queryFn: () => Promise<any>,
    context: string,
    options: RetryableQueryOptions = {}
  ) => {
    const { maxRetries = 3, retryDelay = 1000, onError } = options;
    
    setLoading(true);
    setError(null);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await queryFn();
        setLoading(false);
        return result;
      } catch (err) {
        console.log(`Attempt ${attempt} failed for ${context}:`, err);
        
        if (attempt === maxRetries) {
          const errorMessage = handleError(err, context, {
            toastTitle: `Failed to ${context}`,
            showToast: true
          });
          setError(errorMessage);
          setLoading(false);
          onError?.(err);
          throw err;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }, [handleError]);

  return { executeWithRetry, loading, error };
};
