import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const EmailTestPanel = () => {
  const [testing, setTesting] = useState(false);
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

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-customer-booking-confirmation', {
        body: { bookingId }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Customer confirmation email sent successfully",
      });
    } catch (error: any) {
      console.error('Email test error:', error);
      toast({
        title: "Email Test Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const testWorkerEmail = async () => {
    if (!bookingId || !workerId) {
      toast({
        title: "Error",
        description: "Please enter both booking ID and worker ID",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-worker-assignment-notification', {
        body: { bookingId, workerId }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Worker assignment email sent successfully",
      });
    } catch (error: any) {
      console.error('Email test error:', error);
      toast({
        title: "Email Test Failed",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
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
            disabled={testing || !bookingId}
            variant="outline"
          >
            {testing ? 'Sending...' : 'Test Customer Email'}
          </Button>

          <Button
            onClick={testWorkerEmail}
            disabled={testing || !bookingId || !workerId}
            variant="outline"
          >
            {testing ? 'Sending...' : 'Test Worker Email'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};