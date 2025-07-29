// Optimized API utilities for better performance

// Simple request deduplication without complex typing
const activeRequests = new Map<string, Promise<any>>();

export const deduplicateRequest = async <T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> => {
  if (activeRequests.has(key)) {
    return activeRequests.get(key);
  }

  const promise = requestFn().finally(() => {
    activeRequests.delete(key);
  });

  activeRequests.set(key, promise);
  return promise;
};

// Performance measurement
export const measureApiCall = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`Slow API call: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`Failed API call: ${name} took ${duration.toFixed(2)}ms`, error);
    throw error;
  }
};

// Optimized timeout utility
export const optimizedTimeout = (
  callback: () => void, 
  delay: number = 100
): NodeJS.Timeout => {
  // Cap delays at reasonable maximums for better UX
  const optimizedDelay = Math.min(delay, 300);
  return setTimeout(callback, optimizedDelay);
};

// Cache with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttl: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const apiCache = new SimpleCache();

// Optimized Supabase call wrapper
export const optimizedSupabaseCall = async <T>(
  key: string,
  supabaseCall: () => Promise<T>,
  useCache: boolean = true,
  cacheTTL: number = 30000
): Promise<T> => {
  if (useCache) {
    const cached = apiCache.get(key) as T;
    if (cached) return cached;
  }

  const result = await deduplicateRequest(
    key,
    () => measureApiCall(key, supabaseCall)
  );

  if (useCache) {
    apiCache.set(key, result, cacheTTL);
  }

  return result;
};