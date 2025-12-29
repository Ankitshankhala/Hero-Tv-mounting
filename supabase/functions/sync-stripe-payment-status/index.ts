import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { createStripeClient, corsHeaders } from "../_shared/stripe.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_intent_id, booking_id } = await req.json();

    if (!payment_intent_id && !booking_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'payment_intent_id or booking_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    const stripe = createStripeClient();

    let targetPaymentIntentId = payment_intent_id;
    let targetBookingId = booking_id;

    // If only booking_id provided, fetch the payment_intent_id from booking or transaction
    if (!targetPaymentIntentId && targetBookingId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('payment_intent_id')
        .eq('id', targetBookingId)
        .single();

      if (booking?.payment_intent_id) {
        targetPaymentIntentId = booking.payment_intent_id;
      } else {
        // Try to find from transactions
        const { data: transaction } = await supabase
          .from('transactions')
          .select('payment_intent_id')
          .eq('booking_id', targetBookingId)
          .not('payment_intent_id', 'is', null)
          .limit(1)
          .single();

        if (transaction?.payment_intent_id) {
          targetPaymentIntentId = transaction.payment_intent_id;
        }
      }
    }

    if (!targetPaymentIntentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No payment_intent_id found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC-STRIPE] Fetching PaymentIntent: ${targetPaymentIntentId}`);

    // Fetch PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(targetPaymentIntentId);
    console.log(`[SYNC-STRIPE] Stripe status: ${paymentIntent.status}`);

    // Map Stripe status to our statuses
    let dbPaymentStatus: string;
    let transactionStatus: string;
    let transactionType: string = 'charge';

    switch (paymentIntent.status) {
      case 'succeeded':
        dbPaymentStatus = 'captured';
        transactionStatus = 'completed';
        transactionType = 'capture';
        break;
      case 'requires_capture':
        dbPaymentStatus = 'authorized';
        transactionStatus = 'authorized';
        break;
      case 'canceled':
        dbPaymentStatus = 'cancelled';
        transactionStatus = 'cancelled';
        break;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        dbPaymentStatus = 'pending';
        transactionStatus = 'pending';
        break;
      default:
        dbPaymentStatus = 'failed';
        transactionStatus = 'failed';
    }

    const amountInDollars = paymentIntent.amount / 100;
    const updates: string[] = [];

    // Find the booking if not provided
    if (!targetBookingId) {
      const { data: transaction } = await supabase
        .from('transactions')
        .select('booking_id')
        .eq('payment_intent_id', targetPaymentIntentId)
        .limit(1)
        .single();

      if (transaction?.booking_id) {
        targetBookingId = transaction.booking_id;
      }
    }

    // Update booking
    if (targetBookingId) {
      const bookingUpdate: Record<string, any> = {
        payment_status: dbPaymentStatus,
        payment_intent_id: targetPaymentIntentId,
      };

      // Unarchive if payment is captured
      if (dbPaymentStatus === 'captured') {
        bookingUpdate.is_archived = false;
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .update(bookingUpdate)
        .eq('id', targetBookingId);

      if (bookingError) {
        console.error('[SYNC-STRIPE] Booking update error:', bookingError);
      } else {
        updates.push(`booking: payment_status=${dbPaymentStatus}`);
        console.log(`[SYNC-STRIPE] Updated booking ${targetBookingId}`);
      }
    }

    // Update transaction
    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('payment_intent_id', targetPaymentIntentId)
      .limit(1)
      .single();

    if (existingTransaction) {
      const transactionUpdate: Record<string, any> = {
        status: transactionStatus,
        transaction_type: transactionType,
        amount: amountInDollars,
      };

      if (transactionStatus === 'completed') {
        transactionUpdate.captured_at = new Date().toISOString();
      }

      const { error: txError } = await supabase
        .from('transactions')
        .update(transactionUpdate)
        .eq('id', existingTransaction.id);

      if (txError) {
        console.error('[SYNC-STRIPE] Transaction update error:', txError);
      } else {
        updates.push(`transaction: status=${transactionStatus}`);
        console.log(`[SYNC-STRIPE] Updated transaction ${existingTransaction.id}`);
      }
    }

    // Log to audit
    await supabase.from('booking_audit_log').insert({
      booking_id: targetBookingId,
      operation: 'stripe_sync',
      payment_intent_id: targetPaymentIntentId,
      status: dbPaymentStatus,
      details: {
        stripe_status: paymentIntent.status,
        amount: amountInDollars,
        synced_at: new Date().toISOString(),
      },
    });

    console.log(`[SYNC-STRIPE] Sync complete. Updates: ${updates.join(', ')}`);

    return new Response(
      JSON.stringify({
        success: true,
        stripe_status: paymentIntent.status,
        db_payment_status: dbPaymentStatus,
        transaction_status: transactionStatus,
        amount: amountInDollars,
        updates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SYNC-STRIPE] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
