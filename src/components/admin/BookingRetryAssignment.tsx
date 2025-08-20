import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw } from 'lucide-react';

interface BookingRetryAssignmentProps {
  bookingId: string;
  onRetryComplete?: () => void;
}

export const BookingRetryAssignment = ({ 
  bookingId, 
  onRetryComplete 
}: BookingRetryAssignmentProps) => {
  const [retrying, setRetrying] = useState(false);
  const { toast } = useToast();

  const retryAssignment = async () => {
    setRetrying(true);
    
    try {
      // Call the assign-authorized-booking-worker edge function directly
      const { data, error } = await supabase.functions.invoke(
        'assign-authorized-booking-worker',
        {
          body: { booking_id: bookingId }
        }
      );

      if (error) {
        throw new Error(`Assignment failed: ${error.message}`);
      }

      if (data?.success) {
        if (data.worker_id) {
          toast({
            title: "Worker Assigned Successfully",
            description: "A worker has been automatically assigned to this booking.",
          });
        } else {
          toast({
            title: "Coverage Notifications Sent",
            description: "No direct assignment possible. Workers have been notified for coverage.",
          });
        }
      } else {
        toast({
          title: "Assignment Not Possible",
          description: data?.message || "No workers available for this booking time and location.",
          variant: "destructive",
        });
      }

      onRetryComplete?.();

    } catch (error) {
      console.error('Retry assignment error:', error);
      toast({
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Failed to retry assignment",
        variant: "destructive",
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Button 
      onClick={retryAssignment}
      disabled={retrying}
      variant="outline"
      size="sm"
      className="gap-1"
    >
      <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
      {retrying ? 'Retrying...' : 'Retry Auto-Assign'}
    </Button>
  );
};