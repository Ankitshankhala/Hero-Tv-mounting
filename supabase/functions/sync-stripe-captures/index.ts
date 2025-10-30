import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const { booking_id } = await req.json();

    console.log('[SYNC-STRIPE-CAPTURES] Starting sync for booking:', booking_id);

    // Get all bookings with authorized status (or specific booking if provided)
    let query = supabase
      .from('bookings')
      .select('id, payment_intent_id, payment_status, amount')
      .eq('payment_status', 'authorized')
      .not('payment_intent_id', 'is', null);

    if (booking_id) {
      query = query.eq('id', booking_id);
    }

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No bookings with authorized status found',
          synced: 0,
          skipped: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SYNC-STRIPE-CAPTURES] Found bookings to check:', bookings.length);

    const results = {
      synced: 0,
      skipped: 0,
      errors: [] as any[]
    };

    // Check each booking against Stripe
    for (const booking of bookings) {
      try {
        console.log('[SYNC-STRIPE-CAPTURES] Checking booking:', booking.id);

        // Get payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

        console.log('[SYNC-STRIPE-CAPTURES] Stripe status:', {
          booking_id: booking.id,
          stripe_status: paymentIntent.status,
          db_status: booking.payment_status
        });

        // If Stripe shows succeeded but DB shows authorized, sync it
        if (paymentIntent.status === 'succeeded') {
          const capturedAmount = paymentIntent.amount / 100;

          // Check if capture transaction already exists
          const { data: existingCapture } = await supabase
            .from('transactions')
            .select('id')
            .eq('booking_id', booking.id)
            .eq('payment_intent_id', booking.payment_intent_id)
            .eq('transaction_type', 'capture')
            .maybeSingle();

          if (existingCapture) {
            console.log('[SYNC-STRIPE-CAPTURES] Capture transaction exists, updating booking only');
            
            // Just update the booking status
            await supabase
              .from('bookings')
              .update({ payment_status: 'captured' })
              .eq('id', booking.id);
            
            results.synced++;
            continue;
          }

          // Create capture transaction record
          const { data: newTransaction, error: transactionError } = await supabase
            .from('transactions')
            .insert({
              booking_id: booking.id,
              amount: capturedAmount,
              status: 'completed',
              payment_intent_id: booking.payment_intent_id,
              transaction_type: 'capture',
              payment_method: 'card',
              captured_at: new Date().toISOString()
            })
            .select()
            .single();

          if (transactionError) {
            console.error('[SYNC-STRIPE-CAPTURES] Transaction creation failed:', transactionError);
            results.errors.push({
              booking_id: booking.id,
              error: transactionError.message
            });
            continue;
          }

          // Update booking payment_status to 'captured'
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ payment_status: 'captured' })
            .eq('id', booking.id);

          if (updateError) {
            console.error('[SYNC-STRIPE-CAPTURES] Booking update failed:', updateError);
            results.errors.push({
              booking_id: booking.id,
              error: updateError.message
            });
            continue;
          }

          console.log('[SYNC-STRIPE-CAPTURES] Successfully synced booking:', booking.id);
          results.synced++;
        } else {
          console.log('[SYNC-STRIPE-CAPTURES] Skipping - Stripe status not succeeded:', paymentIntent.status);
          results.skipped++;
        }

      } catch (bookingError: any) {
        console.error('[SYNC-STRIPE-CAPTURES] Error processing booking:', bookingError);
        results.errors.push({
          booking_id: booking.id,
          error: bookingError.message
        });
      }
    }

    console.log('[SYNC-STRIPE-CAPTURES] Sync complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${results.synced} bookings, skipped ${results.skipped}`,
        synced: results.synced,
        skipped: results.skipped,
        errors: results.errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SYNC-STRIPE-CAPTURES] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Sync failed'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
