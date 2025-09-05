import { useCallback } from 'react';
import { measurePerformance, optimizedLog } from '@/utils/performanceOptimizer';

export const usePerformanceLogging = () => {
  const logOperation = useCallback(async <T,>(
    operationName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> => {
    return measurePerformance(operationName, async () => {
      const startTime = Date.now();
      optimizedLog(`[PERF] Starting ${operationName}`, context);
      
      try {
        const result = await operation();
        const duration = Date.now() - startTime;
        optimizedLog(`[PERF] ✅ ${operationName} completed in ${duration}ms`, { ...context, duration });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        optimizedLog(`[PERF] ❌ ${operationName} failed after ${duration}ms`, { ...context, duration, error });
        throw error;
      }
    });
  }, []);

  const logCacheHit = useCallback((cacheKey: string, operation: string) => {
    optimizedLog(`[CACHE] 🎯 Cache hit for ${operation}`, { cacheKey });
  }, []);

  const logCacheMiss = useCallback((cacheKey: string, operation: string) => {
    optimizedLog(`[CACHE] 🔄 Cache miss for ${operation}`, { cacheKey });
  }, []);

  return {
    logOperation,
    logCacheHit,
    logCacheMiss
  };
};