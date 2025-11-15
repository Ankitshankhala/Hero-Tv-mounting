import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface OperationMetrics {
  operationType: 'add' | 'update' | 'remove';
  bookingId: string;
  workerId?: string;
  serviceId?: string;
  serviceName?: string;
  quantity?: number;
  status: 'success' | 'failed' | 'retried';
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: any;
  durationMs: number;
  retryCount?: number;
}

/**
 * Hook for tracking service operations with comprehensive logging
 * Logs both to console (dev) and database (all environments)
 */
export const useServiceOperationTracking = () => {
  const trackOperation = useCallback(async (metrics: OperationMetrics) => {
    const startLog = performance.now();

    // Log to console in development
    if (metrics.status === 'success') {
      logger.dev(`[SERVICE_OP] ${metrics.operationType} succeeded`, {
        duration: `${metrics.durationMs}ms`,
        service: metrics.serviceName,
        booking: metrics.bookingId,
        retries: metrics.retryCount || 0
      });
    } else {
      logger.error(`[SERVICE_OP] ${metrics.operationType} failed`, {
        duration: `${metrics.durationMs}ms`,
        service: metrics.serviceName,
        booking: metrics.bookingId,
        error: metrics.errorCode,
        message: metrics.errorMessage,
        retries: metrics.retryCount || 0
      });
    }

    // Log to database for analytics
    try {
      const { error } = await supabase
        .from('service_operation_logs')
        .insert({
          booking_id: metrics.bookingId,
          worker_id: metrics.workerId,
          operation_type: metrics.operationType,
          service_id: metrics.serviceId,
          service_name: metrics.serviceName,
          quantity: metrics.quantity,
          status: metrics.status,
          error_code: metrics.errorCode,
          error_message: metrics.errorMessage,
          error_details: metrics.errorDetails,
          duration_ms: metrics.durationMs,
          retry_count: metrics.retryCount || 0,
          client_info: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            url: window.location.href
          }
        });

      if (error) {
        logger.error('[TRACKING] Failed to log operation to database:', error);
      }

      const logDuration = performance.now() - startLog;
      if (logDuration > 100) {
        logger.warn(`[TRACKING] Slow logging operation: ${logDuration.toFixed(0)}ms`);
      }
    } catch (error) {
      logger.error('[TRACKING] Exception while logging operation:', error);
    }
  }, []);

  /**
   * Track a successful service addition
   */
  const trackAddSuccess = useCallback((
    bookingId: string,
    serviceData: { id: string; name: string; quantity?: number },
    durationMs: number,
    workerId?: string,
    retryCount?: number
  ) => {
    return trackOperation({
      operationType: 'add',
      bookingId,
      workerId,
      serviceId: serviceData.id,
      serviceName: serviceData.name,
      quantity: serviceData.quantity || 1,
      status: 'success',
      durationMs,
      retryCount
    });
  }, [trackOperation]);

  /**
   * Track a failed service addition
   */
  const trackAddFailure = useCallback((
    bookingId: string,
    serviceData: { id: string; name: string; quantity?: number },
    error: { code?: string; message: string; details?: any },
    durationMs: number,
    workerId?: string,
    retryCount?: number
  ) => {
    return trackOperation({
      operationType: 'add',
      bookingId,
      workerId,
      serviceId: serviceData.id,
      serviceName: serviceData.name,
      quantity: serviceData.quantity || 1,
      status: retryCount && retryCount > 0 ? 'retried' : 'failed',
      errorCode: error.code || 'UNKNOWN',
      errorMessage: error.message,
      errorDetails: error.details,
      durationMs,
      retryCount
    });
  }, [trackOperation]);

  /**
   * Track a service update
   */
  const trackUpdateOperation = useCallback((
    bookingId: string,
    serviceId: string,
    serviceName: string,
    success: boolean,
    durationMs: number,
    workerId?: string,
    error?: { code?: string; message: string }
  ) => {
    return trackOperation({
      operationType: 'update',
      bookingId,
      workerId,
      serviceId,
      serviceName,
      status: success ? 'success' : 'failed',
      errorCode: error?.code,
      errorMessage: error?.message,
      durationMs
    });
  }, [trackOperation]);

  /**
   * Track a service removal
   */
  const trackRemoveOperation = useCallback((
    bookingId: string,
    serviceId: string,
    serviceName: string,
    success: boolean,
    durationMs: number,
    workerId?: string,
    error?: { code?: string; message: string }
  ) => {
    return trackOperation({
      operationType: 'remove',
      bookingId,
      workerId,
      serviceId,
      serviceName,
      status: success ? 'success' : 'failed',
      errorCode: error?.code,
      errorMessage: error?.message,
      durationMs
    });
  }, [trackOperation]);

  return {
    trackAddSuccess,
    trackAddFailure,
    trackUpdateOperation,
    trackRemoveOperation,
    trackOperation
  };
};
