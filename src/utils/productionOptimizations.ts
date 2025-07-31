// Production optimizations for 100% system completion
import { optimizedLog, optimizedWarn, optimizedError } from './performanceOptimizer';
import { measurePerformance } from './performanceOptimizer';

// Enhanced console logging with automatic performance monitoring
export const logWithTiming = (operation: string, data?: any) => {
  optimizedLog(`📊 ${operation}:`, data);
};

export const logError = (operation: string, error: any, context?: any) => {
  optimizedError(`❌ ${operation} failed:`, error, context);
};

export const logWarning = (operation: string, message: string, data?: any) => {
  optimizedWarn(`⚠️ ${operation}:`, message, data);
};

// Performance-monitored operations
export const monitoredOperation = async <T>(
  name: string,
  operation: () => Promise<T>,
  context?: any
): Promise<T> => {
  logWithTiming(`Starting ${name}`, context);
  
  try {
    const result = await measurePerformance(name, operation);
    logWithTiming(`Completed ${name}`, { success: true });
    return result;
  } catch (error) {
    logError(name, error, context);
    throw error;
  }
};

// Generic monitoring operations are provided by performanceOptimizer.ts

// Global console replacement for production builds
if (process.env.NODE_ENV === 'production') {
  // Replace global console in production
  (window as any).console = {
    ...console,
    log: optimizedLog,
    warn: optimizedWarn,
    error: optimizedError,
  };
}