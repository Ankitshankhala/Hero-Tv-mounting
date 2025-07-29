// Performance optimization utilities

// Remove console.log statements in production
export const isDevelopment = process.env.NODE_ENV === 'development';

export const optimizedLog = (...args: any[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export const optimizedError = (...args: any[]) => {
  console.error(...args); // Always log errors
};

export const optimizedWarn = (...args: any[]) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

// Debounce utility for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility for performance
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Optimized timeout with reduced delays
export const optimizedTimeout = (callback: () => void, delay: number = 100) => {
  return setTimeout(callback, Math.min(delay, 500)); // Cap at 500ms max
};

// Request deduplication
const requestCache = new Map<string, Promise<any>>();

export const deduplicateRequest = <T>(
  key: string,
  requestFn: () => Promise<T>,
  ttl: number = 5000
): Promise<T> => {
  if (requestCache.has(key)) {
    return requestCache.get(key);
  }

  const request = requestFn().finally(() => {
    setTimeout(() => requestCache.delete(key), ttl);
  });

  requestCache.set(key, request);
  return request;
};

// Performance measurement
export const measurePerformance = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    if (isDevelopment && duration > 500) {
      optimizedWarn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    optimizedError(`Failed operation: ${name} took ${duration.toFixed(2)}ms`, error);
    throw error;
  }
};

// Memory-efficient array operations
export const batchProcess = <T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 10
): Promise<R[]> => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return Promise.all(batches.map(processor)).then(results => results.flat());
};