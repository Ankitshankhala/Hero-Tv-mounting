
import { useToast } from '@/hooks/use-toast';
import { useErrorMonitoring } from './useErrorMonitoring';

interface ErrorHandlerOptions {
  showToast?: boolean;
  toastTitle?: string;
  fallbackMessage?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export const useErrorHandler = () => {
  const { toast } = useToast();
  const { logError } = useErrorMonitoring();

  const handleError = (
    error: any, 
    context: string, 
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      toastTitle = "Error",
      fallbackMessage = "An unexpected error occurred",
      category,
      metadata
    } = options;

    let errorMessage = fallbackMessage;
    
    // Extract meaningful error messages
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.details) {
      errorMessage = error.details;
    }

    // Handle specific Supabase RLS errors
    if (errorMessage.includes('row-level security policy')) {
      errorMessage = "You don't have permission to access this data";
    } else if (errorMessage.includes('duplicate key value')) {
      errorMessage = "This record already exists";
    } else if (errorMessage.includes('foreign key constraint')) {
      errorMessage = "Cannot complete this action due to related data";
    }

    // Handle Stripe-specific errors
    if (error?.type === 'StripeCardError') {
      errorMessage = `Payment failed: ${error.message}`;
    } else if (error?.type === 'StripeInvalidRequestError') {
      errorMessage = "Invalid payment request. Please try again.";
    } else if (error?.type === 'StripeAPIError') {
      errorMessage = "Payment service temporarily unavailable. Please try again.";
    }

    // Log the error with monitoring
    logError(error, context, {
      category,
      errorMessage,
      originalError: error,
      ...metadata
    });

    if (showToast) {
      toast({
        title: toastTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }

    return errorMessage;
  };

  return { handleError };
};
