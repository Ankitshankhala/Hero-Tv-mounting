// Network utilities for optimized performance

export const fetchWithTimeout = async (
  url: string,
  timeout: number = 800,
  options?: RequestInit
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

// Utility to handle promises that might timeout or fail
export const raceWithFallback = async <T>(
  promises: Promise<T | null>[],
  preferredIndex: number = 0
): Promise<T | null> => {
  try {
    const results = await Promise.allSettled(promises);
    
    // First, try the preferred result if it's fulfilled and not null
    if (results[preferredIndex]?.status === 'fulfilled') {
      const value = results[preferredIndex].value as T | null;
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    
    // Then try any other successful non-null result
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const value = result.value as T | null;
        if (value !== null && value !== undefined) {
          return value;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('All promises failed:', error);
    return null;
  }
};