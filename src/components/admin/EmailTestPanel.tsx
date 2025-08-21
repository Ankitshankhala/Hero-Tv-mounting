import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const EmailTestPanel = () => {
  const [customerTesting, setCustomerTesting] = useState(false);
  const [workerTesting, setWorkerTesting] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const { toast } = useToast();

  const testCustomerEmail = async () => {
    if (!bookingId) {
      toast({
        title: "Error",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    setCustomerTesting(true);
    try {
      console.log('Testing customer email:', { bookingId });
      
      const { data, error } = await supabase.functions.invoke('send-customer-booking-confirmation', {
        body: { bookingId: bookingId.trim() }
      });

      console.log('Customer email test response:', { data, error });

      if (error) {
        console.error('Customer email test error:', error);
        toast({
          title: "Customer Email Test Failed",
          description: `Error: ${error.message || 'Unknown error occurred'}`,
          variant: "destructive",
        });
      } else {
        console.log('Customer email test success:', data);
        toast({
          title: "Customer Email Test Successful",
          description: data?.success ? "Email sent successfully" : `Unexpected response: ${JSON.stringify(data)}`,
        });
      }
    } catch (error: any) {
      console.error('Customer email test exception:', error);
      toast({
        title: "Customer Email Test Error",
        description: `Exception: ${error.message || 'Network or parsing error'}`,
        variant: "destructive",
      });
    } finally {
      setCustomerTesting(false);
    }
  };

  const testWorkerEmail = async (forceResend = false) => {
    if (!bookingId || !workerId) {
      toast({
        title: "Missing Information",
        description: "Please provide both booking ID and worker ID",
        variant: "destructive",
      });
      return;
    }

    setWorkerTesting(true);
    try {
      console.log('Testing worker email:', { bookingId, workerId, force: forceResend });
      
      const { data, error } = await supabase.functions.invoke('send-worker-assignment-notification', {
        body: { 
          bookingId: bookingId.trim(), 
          workerId: workerId.trim(),
          force: forceResend
        }
      });

      console.log('Worker email test response:', { data, error });

      if (error) {
        console.error('Worker email test error:', error);
        toast({
          title: "Worker Email Test Failed",
          description: `Error: ${error.message || 'Unknown error occurred'}`,
          variant: "destructive",
        });
      } else {
        console.log('Worker email test success:', data);
        toast({
          title: "Worker Email Test Successful",
          description: data?.success ? 
            (data.cached ? "Email was already sent (cached)" : "Email sent successfully") :
            `Unexpected response: ${JSON.stringify(data)}`,
        });
      }
    } catch (err: any) {
      console.error('Worker email test exception:', err);
      toast({
        title: "Worker Email Test Error", 
        description: `Exception: ${err.message || 'Network or parsing error'}`,
        variant: "destructive",
      });
    } finally {
      setWorkerTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Testing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Booking ID</label>
          <Input
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="Enter booking ID for testing"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Worker ID (for worker emails)</label>
          <Input
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            placeholder="Enter worker ID for testing"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Button
            onClick={testCustomerEmail}
            disabled={customerTesting || workerTesting || !bookingId}
            variant="outline"
          >
            {customerTesting ? 'Sending...' : 'Test Customer Email'}
          </Button>

          <div className="flex space-x-2">
            <Button
              onClick={() => testWorkerEmail(false)}
              disabled={customerTesting || workerTesting || !bookingId || !workerId}
              variant="outline"
              className="flex-1"
            >
              {workerTesting ? 'Sending...' : 'Test Worker Email'}
            </Button>
            
            <Button
              onClick={() => testWorkerEmail(true)}
              disabled={customerTesting || workerTesting || !bookingId || !workerId}
              variant="destructive"
              className="flex-1"
            >
              {workerTesting ? 'Sending...' : 'Force Resend Worker'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};