
import { useCallback, useState } from 'react';

interface ErrorContext {
  category?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

interface ErrorStats {
  last24Hours: number;
  byCategory: Record<string, number>;
}

export const useErrorMonitoring = () => {
  const [errors, setErrors] = useState<Array<{ error: Error; context: string; timestamp: Date; additionalContext?: ErrorContext }>>([]);

  const logError = useCallback((error: Error, context: string, additionalContext?: ErrorContext) => {
    console.error(`Error in ${context}:`, error, additionalContext);
    
    // Store error for stats
    setErrors(prev => [...prev.slice(-99), { error, context, timestamp: new Date(), additionalContext }]);
    
    // In production, you would send this to your error monitoring service
    // For now, we'll just log to console
  }, []);

  const logPaymentError = useCallback((error: Error, operation: string, context?: ErrorContext) => {
    logError(error, `Payment - ${operation}`, {
      category: 'payment',
      ...context
    });
  }, [logError]);

  const logStripeError = useCallback((error: any, operation: string, context?: ErrorContext) => {
    logError(error, `Stripe - ${operation}`, {
      category: 'stripe',
      stripeErrorType: error.type,
      stripeErrorCode: error.code,
      ...context
    });
  }, [logError]);

  const logSupabaseError = useCallback((error: any, operation: string, context?: ErrorContext) => {
    logError(error, `Supabase - ${operation}`, {
      category: 'supabase',
      supabaseErrorCode: error.code,
      supabaseErrorDetails: error.details,
      ...context
    });
  }, [logError]);

  const getErrorStats = useCallback((): ErrorStats => {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    const recentErrors = errors.filter(e => e.timestamp > last24Hours);
    const byCategory: Record<string, number> = {};
    
    recentErrors.forEach(e => {
      const category = e.additionalContext?.category || 'unknown';
      byCategory[category] = (byCategory[category] || 0) + 1;
    });

    return {
      last24Hours: recentErrors.length,
      byCategory
    };
  }, [errors]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return {
    logError,
    logPaymentError,
    logStripeError,
    logSupabaseError,
    getErrorStats,
    clearErrors
  };
};
