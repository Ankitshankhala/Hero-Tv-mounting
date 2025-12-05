import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClearJobsResult {
  success: boolean;
  archived_count: number;
  message: string;
}

export const useClearCompletedJobs = (onJobsCleared?: () => void) => {
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const clearCompletedJobs = async (): Promise<ClearJobsResult | null> => {
    setIsClearing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('worker-clear-completed', {
        method: 'POST',
      });

      if (error) {
        console.error('Error clearing jobs:', error);
        toast({
          title: 'Error',
          description: 'Failed to clear completed jobs. Please try again.',
          variant: 'destructive',
        });
        return null;
      }

      const result = data as ClearJobsResult;
      
      if (result.success) {
        toast({
          title: 'Jobs Cleared',
          description: result.message,
        });
        
        // Trigger refresh callback
        onJobsCleared?.();
      }

      return result;
    } catch (error) {
      console.error('Error in clearCompletedJobs:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsClearing(false);
    }
  };

  return {
    clearCompletedJobs,
    isClearing,
  };
};
