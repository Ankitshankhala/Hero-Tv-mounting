/**
 * Centralized logging utility
 * Provides environment-aware logging with different levels
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Development-only logs - stripped in production
   */
  dev: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEV]', ...args);
    }
  },

  /**
   * Info logs for important application events
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * Warning logs - shown in development
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error logs - always shown (production and development)
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Performance logs for timing operations
   */
  perf: (operation: string, duration: number) => {
    if (isDevelopment && duration > 100) {
      console.log(`[PERF] ${operation} took ${duration.toFixed(2)}ms`);
    }
  }
};

/**
 * Performance measurement utility
 */
export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T> | T
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    logger.perf(operation, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Failed operation: ${operation} (${duration.toFixed(2)}ms)`, error);
    throw error;
  }
};