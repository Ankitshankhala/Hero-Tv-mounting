
import { useCallback } from 'react';

interface ErrorContext {
  category?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export const useErrorMonitoring = () => {
  const logError = useCallback((error: Error, context: string, additionalContext?: ErrorContext) => {
    console.error(`Error in ${context}:`, error, additionalContext);
    
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

  return {
    logError,
    logPaymentError,
    logStripeError,
    logSupabaseError
  };
};
