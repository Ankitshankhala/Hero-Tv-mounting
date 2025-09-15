import { useCallback } from 'react';
import { measurePerformance } from '@/utils/performanceOptimizer';
import { logger } from '@/utils/logger';

export const usePerformanceLogging = () => {
  const logOperation = useCallback(async <T,>(
    operationName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> => {
    return measurePerformance(operationName, async () => {
      const startTime = Date.now();
      logger.dev(`[PERF] Starting ${operationName}`, context);
      
      try {
        const result = await operation();
        const duration = Date.now() - startTime;
        logger.dev(`[PERF] ✅ ${operationName} completed in ${duration}ms`, { ...context, duration });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.dev(`[PERF] ❌ ${operationName} failed after ${duration}ms`, { ...context, duration, error });
        throw error;
      }
    });
  }, []);

  const logCacheHit = useCallback((cacheKey: string, operation: string) => {
    logger.dev(`[CACHE] 🎯 Cache hit for ${operation}`, { cacheKey });
  }, []);

  const logCacheMiss = useCallback((cacheKey: string, operation: string) => {
    logger.dev(`[CACHE] 🔄 Cache miss for ${operation}`, { cacheKey });
  }, []);

  return {
    logOperation,
    logCacheHit,
    logCacheMiss
  };
};