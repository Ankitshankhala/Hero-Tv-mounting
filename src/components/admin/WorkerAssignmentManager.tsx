import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSmsNotifications } from '@/hooks/useSmsNotifications';
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
  const { sendWorkerAssignmentSms } = useSmsNotifications();

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

      // Send both email and SMS notifications
      let emailSuccess = false;
      let smsSuccess = false;

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
        } else {
          console.log('Worker assignment email response:', emailData);
          emailSuccess = true;
        }
      } catch (emailException) {
        console.error('Exception sending worker assignment email:', emailException);
      }

      // Send SMS notification
      try {
        console.log('Triggering worker assignment SMS for booking:', bookingId);
        smsSuccess = await sendWorkerAssignmentSms(bookingId);
      } catch (smsException) {
        console.error('Exception sending worker assignment SMS:', smsException);
      }

      // Show appropriate success/warning message
      if (emailSuccess && smsSuccess) {
        toast({
          title: "Worker Assigned Successfully",
          description: "Worker has been assigned and notified via email and SMS",
        });
      } else if (emailSuccess || smsSuccess) {
        toast({
          title: "Worker Assigned with Warnings",
          description: `Worker assigned but some notifications failed: ${emailSuccess ? 'Email sent' : 'Email failed'}, ${smsSuccess ? 'SMS sent' : 'SMS failed'}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Worker Assigned with Notification Issues",
          description: "Worker assigned but both email and SMS notifications failed",
          variant: "default"
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