import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BookingData {
  customer_id: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes?: string;
}

interface PaymentFlowResult {
  success: boolean;
  booking_id?: string;
  client_secret?: string;
  payment_intent_id?: string;
  transaction_id?: string;
  error?: string;
}

export const useBookingPaymentFlow = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createBookingWithPayment = async (
    bookingData: BookingData,
    amount: number,
    currency: string = 'usd'
  ): Promise<PaymentFlowResult> => {
    setLoading(true);
    
    try {
      console.log('🔄 Starting booking-first payment flow');

      // Step 1: Create booking with pending status
      console.log('📝 Creating booking with pending status');
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          ...bookingData,
          status: 'pending',
          payment_status: 'pending'
        })
        .select('id')
        .single();

      if (bookingError || !booking) {
        console.error('❌ Failed to create booking:', bookingError);
        throw new Error(`Failed to create booking: ${bookingError?.message || 'Unknown error'}`);
      }

      const bookingId = booking.id;
      console.log('✅ Booking created successfully:', bookingId);

      // Step 2: Create payment intent linked to booking
      console.log('💳 Creating payment intent for booking');
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: amount,
          currency: currency,
          booking_id: bookingId,
          user_id: bookingData.customer_id,
        }
      });

      if (paymentError || !paymentData) {
        console.error('❌ Failed to create payment intent:', paymentError);
        
        // Cleanup: Cancel the booking since payment intent creation failed
        await supabase.functions.invoke('cancel-booking-payment', {
          body: {
            booking_id: bookingId,
            reason: 'payment_intent_creation_failed'
          }
        });

        throw new Error(`Failed to create payment intent: ${paymentError?.message || 'Unknown error'}`);
      }

      console.log('✅ Payment intent created successfully');

      return {
        success: true,
        booking_id: bookingId,
        client_secret: paymentData.client_secret,
        payment_intent_id: paymentData.payment_intent_id,
        transaction_id: paymentData.transaction_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Booking payment flow failed:', errorMessage);
      
      toast({
        title: "Booking Failed",
        description: errorMessage,
        variant: "destructive"
      });

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (
    payment_intent_id: string,
    booking_id: string
  ): Promise<PaymentFlowResult> => {
    try {
      console.log('✅ Confirming payment for booking:', booking_id);

      const { data, error } = await supabase.functions.invoke('confirm-payment', {
        body: {
          payment_intent_id: payment_intent_id,
          booking_id: booking_id
        }
      });

      if (error || !data?.success) {
        console.error('❌ Payment confirmation failed:', error);
        throw new Error(data?.error || error?.message || 'Payment confirmation failed');
      }

      console.log('✅ Payment confirmed successfully');
      
      toast({
        title: "Payment Confirmed",
        description: "Your booking has been confirmed successfully!",
        variant: "default"
      });

      return {
        success: true,
        booking_id: booking_id,
        payment_intent_id: payment_intent_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Payment confirmation failed:', errorMessage);
      
      toast({
        title: "Payment Confirmation Failed",
        description: errorMessage,
        variant: "destructive"
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const cancelBookingPayment = async (
    booking_id: string,
    payment_intent_id?: string,
    reason: string = 'user_cancelled'
  ): Promise<PaymentFlowResult> => {
    try {
      console.log('❌ Cancelling booking payment:', booking_id);

      const { data, error } = await supabase.functions.invoke('cancel-booking-payment', {
        body: {
          booking_id: booking_id,
          payment_intent_id: payment_intent_id,
          reason: reason
        }
      });

      if (error || !data?.success) {
        console.error('❌ Booking cancellation failed:', error);
        throw new Error(data?.error || error?.message || 'Booking cancellation failed');
      }

      console.log('✅ Booking cancelled successfully');
      
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled.",
        variant: "default"
      });

      return {
        success: true,
        booking_id: booking_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Booking cancellation failed:', errorMessage);
      
      toast({
        title: "Cancellation Failed",
        description: errorMessage,
        variant: "destructive"
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  return {
    loading,
    createBookingWithPayment,
    confirmPayment,
    cancelBookingPayment
  };
};