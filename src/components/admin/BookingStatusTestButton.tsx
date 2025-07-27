import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const BookingStatusTestButton = () => {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testBookingStatusFlow = async () => {
    setTesting(true);
    try {
      const bookingId = '1364c530-90bc-4673-a249-bcd24a9edfd7';
      
      // First, check current booking status
      const { data: booking } = await supabase
        .from('bookings')
        .select('status, payment_status')
        .eq('id', bookingId)
        .single();
      
      console.log('Current booking status:', booking);

      // Update booking to completed status to test auto-invoice trigger
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Error updating booking status:', updateError);
        toast({
          title: 'Status Update Failed',
          description: `Error: ${updateError.message}`,
          variant: 'destructive'
        });
        return;
      }

      console.log('Updated booking to completed status');
      
      toast({
        title: 'Booking Status Updated',
        description: 'Updated to completed - checking for auto-invoice'
      });

      // Check for invoice generation after a delay
      setTimeout(async () => {
        const { data: invoices } = await supabase
          .from('invoices')
          .select('*')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false });
        
        console.log('Invoices for booking:', invoices);

        const { data: emailLogs } = await supabase
          .from('email_logs')
          .select('*')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false })
          .limit(3);
        
        console.log('Email logs for booking:', emailLogs);
      }, 3000);

    } catch (error) {
      console.error('Booking status test error:', error);
      toast({
        title: 'Test Failed',
        description: 'Check console for details',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Button onClick={testBookingStatusFlow} disabled={testing} variant="secondary">
      {testing ? 'Testing Flow...' : 'Test Booking → Invoice Flow'}
    </Button>
  );
};