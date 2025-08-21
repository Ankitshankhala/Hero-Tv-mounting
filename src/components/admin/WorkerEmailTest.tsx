import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const WorkerEmailTest = () => {
  const [bookingId, setBookingId] = useState('');
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testWorkerAssignment = async () => {
    if (!bookingId) {
      toast({
        title: "Missing Information",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      console.log('Testing worker assignment for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('assign-authorized-booking-worker', {
        body: { 
          booking_id: bookingId.trim()
        }
      });

      if (error) {
        console.error('Function error:', error);
        toast({
          title: "Error",
          description: `Function error: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Function response:', data);
      
      if (data?.success) {
        toast({
          title: "Success",
          description: `Worker assignment successful! Worker ID: ${data.worker_id}`,
        });
      } else {
        toast({
          title: "Assignment Failed",
          description: data?.message || "Worker assignment failed",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Unexpected Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Worker Assignment Test</CardTitle>
        <CardDescription>
          Test the worker assignment function for a specific booking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bookingId">Booking ID</Label>
          <Input
            id="bookingId"
            placeholder="Enter booking ID"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Button
            onClick={testWorkerAssignment}
            disabled={testing || !bookingId}
            className="w-full"
          >
            {testing ? 'Testing Assignment...' : 'Test Worker Assignment'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};