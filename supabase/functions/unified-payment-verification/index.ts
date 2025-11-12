import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createStripeClient, corsHeaders } from '../_shared/stripe.ts';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNIFIED-PAYMENT-VERIFICATION] ${step}${detailsStr}`);
};

interface VerificationRequest {
  sessionId?: string;
  paymentIntentId?: string;
  bookingId?: string;
  verificationType: 'session' | 'intent' | 'booking';
  syncStatuses?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      sessionId, 
      paymentIntentId, 
      bookingId, 
      verificationType = 'intent',
      syncStatuses = true 
    }: VerificationRequest = await req.json();

    logStep('Starting unified payment verification', { 
      verificationType, 
      sessionId: sessionId ? 'provided' : null,
      paymentIntentId: paymentIntentId ? 'provided' : null,
      bookingId: bookingId ? 'provided' : null
    });

    const stripe = createStripeClient();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    let stripeObject: any;
    let finalPaymentIntentId: string | null = null;
    let finalBookingId: string | null = bookingId || null;

    // Step 1: Retrieve Stripe object based on verification type
    switch (verificationType) {
      case 'session':
        if (!sessionId) {
          throw new Error('Session ID is required for session verification');
        }
        logStep('Retrieving Stripe session', { sessionId });
        stripeObject = await stripe.checkout.sessions.retrieve(sessionId);
        finalPaymentIntentId = stripeObject.payment_intent as string;
        break;

      case 'intent':
        if (!paymentIntentId) {
          throw new Error('Payment Intent ID is required for intent verification');
        }
        logStep('Retrieving Stripe payment intent', { paymentIntentId });
        stripeObject = await stripe.paymentIntents.retrieve(paymentIntentId);
        finalPaymentIntentId = paymentIntentId;
        break;

      case 'booking':
        if (!bookingId) {
          throw new Error('Booking ID is required for booking verification');
        }
        // Get payment intent from booking
        const { data: booking } = await supabase
          .from('bookings')
          .select('payment_intent_id')
          .eq('id', bookingId)
          .single();
        
        if (!booking?.payment_intent_id) {
          throw new Error('No payment intent found for booking');
        }
        
        finalPaymentIntentId = booking.payment_intent_id;
        logStep('Retrieving payment intent from booking', { finalPaymentIntentId });
        stripeObject = await stripe.paymentIntents.retrieve(finalPaymentIntentId);
        break;
    }

    if (!stripeObject) {
      throw new Error(`Failed to retrieve ${verificationType} from Stripe`);
    }

    // Step 2: Get booking if not already known
    if (!finalBookingId && finalPaymentIntentId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('id')
        .eq('payment_intent_id', finalPaymentIntentId)
        .single();
      
      finalBookingId = booking?.id || null;
    }

    logStep('Retrieved Stripe object', { 
      status: stripeObject.status || stripeObject.payment_status,
      paymentIntentId: finalPaymentIntentId,
      bookingId: finalBookingId
    });

    // Step 3: Update transaction status based on Stripe object
    let transactionUpdated = false;
    if (finalPaymentIntentId) {
      const stripeStatus = stripeObject.status || stripeObject.payment_status;
      
      if (stripeStatus === 'paid' || stripeStatus === 'succeeded') {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ 
            status: 'completed',
            captured_at: new Date().toISOString()
          })
          .eq('payment_intent_id', finalPaymentIntentId);

        if (updateError) {
          logStep('Failed to update transaction', { error: updateError });
        } else {
          logStep('Transaction updated to completed');
          transactionUpdated = true;
        }
      }
    }

    // Step 4: Update booking status if needed and sync is enabled
    let bookingUpdated = false;
    if (finalBookingId && syncStatuses) {
      const stripeStatus = stripeObject.status || stripeObject.payment_status;
      
      if (stripeStatus === 'paid' || stripeStatus === 'succeeded') {
        // Only update to confirmed if booking is in pending/payment states
        // Don't override completed status set by workers
        const { error: bookingError } = await supabase
          .from('bookings')
          .update({ 
            status: 'confirmed',
            payment_status: 'captured'
          })
          .eq('id', finalBookingId)
          .in('status', ['pending', 'payment_pending', 'payment_authorized']);

        if (bookingError) {
          logStep('Failed to update booking', { error: bookingError });
        } else {
          logStep('Booking updated to confirmed');
          bookingUpdated = true;
        }
      }
    }

    // Step 5: Sync with unified payment status sync if needed
    let syncResult = null;
    if (syncStatuses && finalBookingId) {
      try {
        const { data: syncData, error: syncError } = await supabase.functions.invoke(
          'unified-payment-status-sync',
          {
            body: {
              booking_id: finalBookingId,
              payment_intent_id: finalPaymentIntentId,
              force_sync: true
            }
          }
        );

        if (syncError) {
          logStep('Sync failed but continuing', { error: syncError });
        } else {
          syncResult = syncData;
          logStep('Status sync completed', syncResult);
        }
      } catch (syncError) {
        logStep('Sync failed but continuing', { error: syncError });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      verificationType,
      status: stripeObject.status || stripeObject.payment_status,
      paymentIntentId: finalPaymentIntentId,
      bookingId: finalBookingId,
      transactionId: finalPaymentIntentId,
      updates: {
        transaction: transactionUpdated,
        booking: bookingUpdated,
        sync: syncResult !== null
      },
      syncResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Error in unified payment verification', { error: errorMessage });
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});