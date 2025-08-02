import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useEmailNotifications } from '@/hooks/useEmailNotifications';
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
  const { sendWorkerAssignmentEmail } = useEmailNotifications();

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

      // Send worker assignment email using the new email system
      const emailSent = await sendWorkerAssignmentEmail(bookingId);

      if (emailSent) {
        toast({
          title: "Worker Assigned Successfully",
          description: "Worker has been assigned and notified via email",
        });
      } else {
        toast({
          title: "Worker Assigned",
          description: "Worker assigned but email notification failed",
          variant: "destructive",
        });
      }

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
      {assigning ? 'Assigning...' : 'Assign Worker & Send Email'}
    </Button>
  );
};