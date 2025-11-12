
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
      // Fetch worker and booking details for email and validation
      const { data: worker, error: workerError } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', workerId)
        .single();

      if (workerError || !worker) {
        throw new Error('Failed to fetch worker details');
      }

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('customer_id, guest_customer_info, scheduled_date, scheduled_start')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error('Failed to fetch booking details');
      }

      // VALIDATE WORKER AVAILABILITY
      const { data: validationResult, error: validationError } = await supabase.rpc(
        'validate_worker_booking_assignment',
        {
          p_worker_id: workerId,
          p_booking_date: booking.scheduled_date,
          p_booking_time: booking.scheduled_start,
          p_duration_minutes: 60
        }
      );

      if (validationError) {
        throw new Error(`Validation check failed: ${validationError.message}`);
      }

      if (validationResult && validationResult.length > 0) {
        const validation = validationResult[0];
        
        if (!validation.is_valid) {
          toast({
            title: "Worker Unavailable",
            description: validation.error_message,
            variant: "destructive",
          });
          setAssigning(false);
          return;
        }
      }

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

      // Send worker notification
      try {
        await supabase.functions.invoke('unified-email-dispatcher', {
          body: {
            bookingId,
            recipientEmail: worker.email,
            emailType: 'worker_assignment'
          }
        });
      } catch (workerEmailError) {
        console.warn('Worker email notification failed:', workerEmailError);
      }

      // Send customer notification
      try {
        let customerEmail = null;
        if (booking.customer_id) {
          const { data: customer } = await supabase
            .from('users')
            .select('email')
            .eq('id', booking.customer_id)
            .single();
          customerEmail = customer?.email;
        } else if (booking.guest_customer_info) {
          const guestInfo = booking.guest_customer_info as { email?: string };
          customerEmail = guestInfo.email;
        }

        if (customerEmail) {
          await supabase.functions.invoke('unified-email-dispatcher', {
            body: {
              bookingId,
              recipientEmail: customerEmail,
              emailType: 'booking_confirmation'
            }
          });
        }
      } catch (customerEmailError) {
        console.warn('Customer email notification failed:', customerEmailError);
      }

      toast({
        title: "Worker Assigned Successfully",
        description: "Worker has been assigned and notifications sent.",
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
