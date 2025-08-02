import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
// Email functionality removed
import { supabase } from '@/integrations/supabase/client';

interface WorkerAssignmentManagerProps {
  bookingId: string;
  workerId: string;
  onAssignmentComplete?: () => void;
}

export const WorkerAssignmentManager = ({ 
  bookingId, 
  workerId, 
  onAssignmentComplete 
}: WorkerAssignmentManagerProps) => {
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();
  // Email functionality removed

  const assignWorkerWithEmail = async () => {
    setAssigning(true);
    
    try {
      // First assign the worker to the booking
      const { error: assignmentError } = await supabase
        .from('bookings')
        .update({ 
          worker_id: workerId,
          status: 'confirmed' 
        })
        .eq('id', bookingId);

      if (assignmentError) {
        throw new Error(`Failed to assign worker: ${assignmentError.message}`);
      }

      // Email functionality removed - worker assigned without email notification

      // Send worker assignment email
      try {
        console.log('Triggering worker assignment email for booking:', bookingId, 'worker:', workerId);
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-worker-assignment-notification', {
          body: { 
            bookingId,
            workerId 
          }
        });
        
        if (emailError) {
          console.error('Worker assignment email error:', emailError);
          toast({
            title: "Email Warning",
            description: "Worker assigned but notification email may not have been sent.",
            variant: "default"
          });
        } else {
          console.log('Worker assignment email response:', emailData);
        }
      } catch (emailException) {
        console.error('Exception sending worker assignment email:', emailException);
        toast({
          title: "Email Warning", 
          description: "Worker assigned but notification email failed.",
          variant: "default"
        });
      }

      toast({
        title: "Worker Assigned Successfully",
        description: "Worker has been assigned to the booking and notified via email",
      });

      onAssignmentComplete?.();

    } catch (error) {
      console.error('Worker assignment error:', error);
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Failed to assign worker",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Button 
      onClick={assignWorkerWithEmail}
      disabled={assigning}
      className="w-full"
    >
      {assigning ? 'Assigning...' : 'Assign Worker'}
    </Button>
  );
};