
import { useToast } from '@/hooks/use-toast';

interface ErrorHandlerOptions {
  showToast?: boolean;
  toastTitle?: string;
  fallbackMessage?: string;
}

export const useErrorHandler = () => {
  const { toast } = useToast();

  const handleError = (
    error: any, 
    context: string, 
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      toastTitle = "Error",
      fallbackMessage = "An unexpected error occurred"
    } = options;

    console.error(`Error in ${context}:`, error);

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
