import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  const timestamp = new Date().toISOString();
  console.log(`[HANDLE-PAYMENT-SUCCESS] ${timestamp} - ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Payment success handler started");

    const { payment_intent_id, booking_id } = await req.json();

    if (!payment_intent_id && !booking_id) {
      throw new Error('Either payment_intent_id or booking_id is required');
    }

    // Initialize clients
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    let finalPaymentIntentId = payment_intent_id;

    // If only booking_id provided, get payment_intent_id from booking
    if (!finalPaymentIntentId && booking_id) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('payment_intent_id')
        .eq('id', booking_id)
        .single();

      if (booking?.payment_intent_id) {
        finalPaymentIntentId = booking.payment_intent_id;
        logStep("Retrieved payment_intent_id from booking", { payment_intent_id: finalPaymentIntentId });
      } else {
        throw new Error('No payment intent found for booking');
      }
    }

    logStep("Verifying payment intent with Stripe", { payment_intent_id: finalPaymentIntentId });

    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(finalPaymentIntentId);
    
    logStep("Payment intent retrieved", { 
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    });

    // Determine status based on Stripe payment intent
    let transactionStatus: string;
    let bookingStatus: string;
    let paymentStatus: string;

    switch (paymentIntent.status) {
      case 'requires_capture':
        transactionStatus = 'authorized';
        bookingStatus = 'payment_authorized';
        paymentStatus = 'authorized';
        break;
      case 'succeeded':
        transactionStatus = 'completed';
        bookingStatus = 'confirmed';
        paymentStatus = 'completed';
        break;
      case 'canceled':
      case 'failed':
        transactionStatus = 'failed';
        bookingStatus = 'failed';
        paymentStatus = 'failed';
        break;
      default:
        transactionStatus = 'pending';
        bookingStatus = 'payment_pending';
        paymentStatus = 'pending';
    }

    logStep("Status mapping determined", { 
      stripe_status: paymentIntent.status,
      transaction_status: transactionStatus,
      booking_status: bookingStatus,
      payment_status: paymentStatus
    });

    // Find and update transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('id, booking_id, status')
      .eq('payment_intent_id', finalPaymentIntentId)
      .single();

    if (transactionError || !transaction) {
      // No transaction found - to avoid enum mismatch issues, skip creating a new transaction.
      logStep("Transaction not found, skipping creation and syncing booking only", { payment_intent_id: finalPaymentIntentId });
      
      let bookingIdToUpdate = booking_id || null;

      if (!bookingIdToUpdate) {
        const { data: bookingLookup } = await supabase
          .from('bookings')
          .select('id')
          .eq('payment_intent_id', finalPaymentIntentId)
          .maybeSingle();
        bookingIdToUpdate = bookingLookup?.id || null;
      }

      if (bookingIdToUpdate) {
        await updateBookingStatus(supabase, bookingIdToUpdate, bookingStatus, paymentStatus);
      }
    }
    else {
      // Update existing transaction
      if (transaction.status !== transactionStatus) {
        logStep("Updating transaction status", { 
          transaction_id: transaction.id,
          old_status: transaction.status,
          new_status: transactionStatus
        });

        const { error: updateError } = await supabase
          .from('transactions')
          .update({ status: transactionStatus })
          .eq('id', transaction.id);

        if (updateError) {
          logStep("Failed to update transaction", { error: updateError });
          throw new Error(`Failed to update transaction: ${updateError.message}`);
        }

        logStep("Transaction updated successfully");
      }

      // Update booking status
      if (transaction.booking_id) {
        await updateBookingStatus(supabase, transaction.booking_id, bookingStatus, paymentStatus);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      payment_intent_id: finalPaymentIntentId,
      stripe_status: paymentIntent.status,
      transaction_status: transactionStatus,
      booking_status: bookingStatus,
      payment_status: paymentStatus
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep("Error in payment success handler", { error: error.message });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function updateBookingStatus(supabase: any, bookingId: string, bookingStatus: string, paymentStatus: string) {
  logStep("Updating booking status", { 
    booking_id: bookingId,
    new_booking_status: bookingStatus,
    new_payment_status: paymentStatus
  });

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ 
      status: bookingStatus,
      payment_status: paymentStatus
    })
    .eq('id', bookingId);

  if (bookingError) {
    logStep("Failed to update booking", { error: bookingError });
    throw new Error(`Failed to update booking: ${bookingError.message}`);
  }

  logStep("Booking updated successfully");
}