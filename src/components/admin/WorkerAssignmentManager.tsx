
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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

      // Use smart email dispatcher (no force option to prevent duplicates)
      const { data: emailResult, error: emailError } = await supabase.functions.invoke('smart-email-dispatcher', {
        body: {
          bookingId,
          workerId,
          emailType: 'worker_assignment',
          source: 'manual'
        }
      });

      if (emailError) {
        console.warn('Email notification failed:', emailError);
        toast({
          title: "Worker Assigned",
          description: "Worker has been assigned but email notification failed. Check logs for details.",
          variant: "destructive",
        });
      } else if (emailResult?.cached) {
        toast({
          title: "Worker Already Assigned",
          description: "Worker was already assigned to this booking. No duplicate email sent.",
        });
      } else {
        toast({
          title: "Worker Assigned Successfully",
          description: "Worker has been assigned and notification email sent.",
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
      {assigning ? 'Assigning...' : 'Assign Worker'}
    </Button>
  );
};
