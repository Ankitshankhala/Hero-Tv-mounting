import { logger } from './logger';

interface ServiceLoadMetrics {
  duration: number;
  success: boolean;
  serviceCount: number;
  retryCount: number;
  errorType?: string;
}

/**
 * Track service loading performance and failures
 */
export const trackServiceLoad = (metrics: ServiceLoadMetrics) => {
  const { duration, success, serviceCount, retryCount, errorType } = metrics;

  // Log to console in development
  if (success) {
    logger.dev(`[METRICS] Services loaded successfully`, {
      duration: `${duration.toFixed(0)}ms`,
      count: serviceCount,
      retries: retryCount
    });
  } else {
    logger.error(`[METRICS] Services load failed`, {
      duration: `${duration.toFixed(0)}ms`,
      errorType,
      retries: retryCount
    });
  }

  // Send to Google Analytics (if available)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', success ? 'services_load_success' : 'services_load_error', {
      event_category: 'Services',
      event_label: success ? 'Success' : errorType || 'Unknown Error',
      value: Math.round(duration),
      service_count: serviceCount,
      retry_count: retryCount
    });
  }

  // Alert on slow loads (>3 seconds)
  if (success && duration > 3000) {
    logger.warn(`[PERFORMANCE] Slow service load: ${duration.toFixed(0)}ms`, {
      serviceCount,
      retryCount
    });
  }

  // Alert on repeated failures
  if (!success && retryCount >= 3) {
    logger.error(`[CRITICAL] All service load retries exhausted`, {
      retryCount,
      errorType
    });
  }
};

/**
 * Track Error Boundary triggers
 */
export const trackErrorBoundary = (error: Error, componentStack: string) => {
  logger.error('[ERROR_BOUNDARY] Component error caught', {
    error: error.message,
    stack: error.stack,
    componentStack
  });

  // Send to analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'error_boundary_triggered', {
      event_category: 'Errors',
      event_label: error.message,
      non_interaction: true
    });
  }
};