import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

export const BookingStatusTestButton = () => {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
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

  const syncPaymentStatuses = async () => {
    setSyncing(true);
    try {
      // Call the unified payment status sync function without parameters to trigger backfill
      const { data, error } = await supabase.functions.invoke('unified-payment-status-sync', {
        body: { 
          trigger_backfill: true,
          force_sync: true 
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('Sync result:', data);
      
      toast({
        title: 'Payment Status Sync',
        description: data?.message || 'Payment statuses have been synchronized',
      });

      // Also run the booking consistency check for authorized payments
      const { data: consistencyData, error: consistencyError } = await supabase.functions.invoke('booking-status-consistency-check', {
        body: { 
          booking_id: '6cc94f20-13fd-499c-a185-3b10bdfa79f0',  // The specific booking with authorized payment
          payment_intent_id: 'pi_3S4uZqCrUPkotWKC1fbfuolC'
        }
      });

      if (consistencyError) {
        console.error('Consistency check error:', consistencyError);
      } else {
        console.log('Consistency check result:', consistencyData);
      }

    } catch (error) {
      console.error('Payment sync error:', error);
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Check console for details',
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={testBookingStatusFlow} disabled={testing} variant="secondary">
        {testing ? 'Testing Flow...' : 'Test Booking → Invoice Flow'}
      </Button>
      <Button 
        onClick={syncPaymentStatuses} 
        disabled={syncing} 
        variant="outline"
        className="flex items-center gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Sync Payment Status'}
      </Button>
    </div>
  );
};