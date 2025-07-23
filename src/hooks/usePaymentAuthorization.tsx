
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentAuthorizationData {
  booking_id?: string | null;
  amount: number;
  currency?: string;
  // Legacy fields for backwards compatibility
  bookingId?: string;
  customerEmail?: string;
  customerName?: string;
  requireAuth?: boolean;
}

interface PaymentAuthorizationResult {
  success: boolean;
  client_secret?: string;
  payment_intent_id?: string;
  transaction_id?: string;
  error?: string;
}

export const usePaymentAuthorization = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const createPaymentAuthorization = async (
    data: PaymentAuthorizationData
  ): Promise<PaymentAuthorizationResult> => {
    setProcessing(true);
    
    try {
      console.log('🔄 Starting payment authorization with data:', {
        booking_id: data.booking_id || data.bookingId,
        amount: data.amount,
        currency: data.currency
      });

      // Validate required fields
      if (!data.amount || data.amount <= 0) {
        throw new Error('Valid payment amount is required');
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required for payment authorization');
      }

      // Handle booking_id - can be null, a valid UUID, or legacy bookingId
      let booking_id: string | null = null;
      if (data.booking_id) {
        booking_id = data.booking_id;
      } else if (data.bookingId && data.bookingId !== 'test-booking-id' && !data.bookingId.startsWith('temp-')) {
        booking_id = data.bookingId;
      }

      // Additional validation for booking ID format
      if (data.bookingId === 'test-booking-id' || data.booking_id === 'test-booking-id') {
        throw new Error('Test booking ID cannot be used for real payments');
      }

      console.log('📡 Calling create-payment-intent edge function...');
      
      const { data: result, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: data.amount,
          currency: data.currency || 'usd',
          booking_id: booking_id,
          user_id: user.id,
        }
      });
      
      console.log('📡 Edge function raw response:', { result, error });

      console.log('📡 Edge function response:', { result, error });

      if (error) {
        console.error('❌ Payment authorization error from edge function:', error);
        
        // Improved error handling with more specific messages
        const errorMessage = error.message || 'Unknown error occurred';
        
        if (errorMessage.includes('Invalid booking ID') || errorMessage.includes('Booking not found')) {
          throw new Error('The booking reference is invalid. Please try creating a new booking.');
        } else if (errorMessage.includes('STRIPE_SECRET_KEY') || errorMessage.includes('Stripe')) {
          throw new Error('Payment service configuration error. Please contact support.');
        } else if (errorMessage.includes('amount') || errorMessage.includes('required fields')) {
          throw new Error('Invalid payment amount. Please refresh and try again.');
        } else if (errorMessage.includes('customer')) {
          throw new Error('Customer information is missing. Please check your details.');
        } else {
          throw new Error(`Payment setup failed: ${errorMessage}`);
        }
      }

      if (!result?.client_secret) {
        console.error('❌ No client secret received:', result);
        throw new Error('Invalid payment authorization response - missing client secret');
      }

      console.log('✅ Payment authorization created successfully');
      
      toast({
        title: "Payment Authorization Created",
        description: "Payment method will be charged after service completion",
      });

      return {
        success: true,
        client_secret: result.client_secret,
        payment_intent_id: result.payment_intent_id,
        transaction_id: result.transaction_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment authorization failed';
      console.error('❌ Payment authorization failed:', error);
      
      toast({
        title: "Payment Authorization Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setProcessing(false);
    }
  };

  const capturePayment = async (bookingId: string): Promise<PaymentAuthorizationResult> => {
    setProcessing(true);
    
    try {
      console.log('🔄 Capturing payment for booking:', bookingId);

      const { data: result, error } = await supabase.functions.invoke('capture-payment-intent', {
        body: { bookingId }
      });

      if (error) {
        console.error('❌ Payment capture error:', error);
        throw new Error(error.message || 'Failed to capture payment');
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Payment capture failed');
      }

      console.log('✅ Payment captured successfully');
      
      toast({
        title: "Payment Captured Successfully",
        description: `$${result.amount_captured?.toFixed(2)} has been charged`,
      });

      return {
        success: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment capture failed';
      console.error('❌ Payment capture failed:', error);
      
      toast({
        title: "Payment Capture Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setProcessing(false);
    }
  };

  return {
    createPaymentAuthorization,
    capturePayment,
    processing
  };
};
