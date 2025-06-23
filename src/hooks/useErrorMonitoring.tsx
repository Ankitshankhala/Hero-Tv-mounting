
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ErrorLog {
  id: string;
  timestamp: Date;
  error: Error | string;
  context: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface ErrorMonitoringConfig {
  enableConsoleLogging?: boolean;
  enableToastNotifications?: boolean;
  enableLocalStorage?: boolean;
  maxStoredErrors?: number;
}

export const useErrorMonitoring = (config: ErrorMonitoringConfig = {}) => {
  const {
    enableConsoleLogging = true,
    enableToastNotifications = true,
    enableLocalStorage = true,
    maxStoredErrors = 50
  } = config;

  const { toast } = useToast();
  const [errors, setErrors] = useState<ErrorLog[]>([]);

  const logError = useCallback((
    error: Error | string,
    context: string,
    metadata?: Record<string, any>
  ) => {
    const errorLog: ErrorLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      error,
      context,
      metadata
    };

    // Console logging
    if (enableConsoleLogging) {
      console.error(`[${context}] Error:`, error, metadata);
    }

    // Store in state
    setErrors(prev => {
      const newErrors = [errorLog, ...prev];
      return newErrors.slice(0, maxStoredErrors);
    });

    // Store in localStorage for persistence
    if (enableLocalStorage) {
      try {
        const storedErrors = JSON.parse(localStorage.getItem('error_logs') || '[]');
        const updatedErrors = [errorLog, ...storedErrors].slice(0, maxStoredErrors);
        localStorage.setItem('error_logs', JSON.stringify(updatedErrors));
      } catch (e) {
        console.warn('Failed to store error in localStorage:', e);
      }
    }

    // Show toast notification for user-facing errors
    if (enableToastNotifications && !context.includes('background')) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: "Error Occurred",
        description: errorMessage,
        variant: "destructive",
      });
    }

    return errorLog.id;
  }, [toast, enableConsoleLogging, enableToastNotifications, enableLocalStorage, maxStoredErrors]);

  const logPaymentError = useCallback((
    error: Error | string,
    paymentContext: string,
    paymentData?: Record<string, any>
  ) => {
    return logError(error, `Payment Error - ${paymentContext}`, {
      category: 'payment',
      ...paymentData
    });
  }, [logError]);

  const logStripeError = useCallback((
    error: Error | string,
    stripeContext: string,
    stripeData?: Record<string, any>
  ) => {
    return logError(error, `Stripe Error - ${stripeContext}`, {
      category: 'stripe',
      ...stripeData
    });
  }, [logError]);

  const logSupabaseError = useCallback((
    error: Error | string,
    supabaseContext: string,
    supabaseData?: Record<string, any>
  ) => {
    return logError(error, `Supabase Error - ${supabaseContext}`, {
      category: 'supabase',
      ...supabaseData
    });
  }, [logError]);

  const clearErrors = useCallback(() => {
    setErrors([]);
    if (enableLocalStorage) {
      localStorage.removeItem('error_logs');
    }
  }, [enableLocalStorage]);

  const getErrorStats = useCallback(() => {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return {
      total: errors.length,
      lastHour: errors.filter(e => e.timestamp > lastHour).length,
      last24Hours: errors.filter(e => e.timestamp > last24Hours).length,
      byCategory: errors.reduce((acc, error) => {
        const category = error.metadata?.category || 'unknown';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }, [errors]);

  return {
    errors,
    logError,
    logPaymentError,
    logStripeError,
    logSupabaseError,
    clearErrors,
    getErrorStats
  };
};
