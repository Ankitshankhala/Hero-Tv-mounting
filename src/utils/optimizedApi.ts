// Optimized API utilities for better performance
import { 
  deduplicateRequest as canonicalDedup, 
  measurePerformance,
  optimizedTimeout as canonicalTimeout 
} from './performanceOptimizer';

// Re-export canonical functions with API-specific naming
export const deduplicateRequest = canonicalDedup;
export const measureApiCall = measurePerformance;
export const optimizedTimeout = canonicalTimeout;

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

  const result = await canonicalDedup(
    key,
    () => measurePerformance(key, supabaseCall),
    0 // No TTL for immediate cleanup after request
  );

  if (useCache) {
    apiCache.set(key, result, cacheTTL);
  }

  return result;
};