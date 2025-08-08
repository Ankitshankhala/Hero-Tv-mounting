import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const WorkerAssignmentTester = () => {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testWorkerAssignment = async () => {
    setTesting(true);
    try {
      // Get the most recent booking without a worker
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, status, worker_id, guest_customer_info')
        .is('worker_id', null)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (bookingError || !booking) {
        toast({
          title: "No Test Booking Found",
          description: "Create a confirmed booking without a worker to test assignment.",
          variant: "destructive",
        });
        return;
      }

      console.log('Testing assignment for booking:', booking.id);

      // Test the auto-assignment function
      const { data: assignmentResult, error: assignmentError } = await supabase.rpc(
        'auto_assign_workers_with_coverage',
        { p_booking_id: booking.id }
      );

      if (assignmentError) {
        console.error('Assignment error:', assignmentError);
        toast({
          title: "Assignment Failed",
          description: `Error: ${assignmentError.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Assignment result:', assignmentResult);

      if (assignmentResult && assignmentResult.length > 0) {
        const result = assignmentResult[0];
        
        if (result.assignment_status === 'direct_assigned' && result.assigned_worker_id) {
          toast({
            title: "Assignment Test Complete",
            description: "Worker assigned. Notifications will be sent automatically by the system.",
          });
        } else {
          toast({
            title: "Coverage Notifications Sent",
            description: `Sent notifications to ${result.notifications_sent || 'multiple'} workers`,
          });
        }
      } else {
        toast({
          title: "No Workers Available",
          description: "No workers found for assignment in the booking area",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Worker Assignment Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Test the worker assignment system with the most recent unassigned booking.
        </p>
        <Button 
          onClick={testWorkerAssignment}
          disabled={testing}
          className="w-full"
        >
          {testing ? 'Testing Assignment...' : 'Test Worker Assignment'}
        </Button>
      </CardContent>
    </Card>
  );
};