import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    console.log('[SYNC] Starting authorized bookings sync...');

    // Find all bookings with payment_pending status that have payment_intent_id
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, payment_intent_id, status, payment_status')
      .eq('status', 'payment_pending')
      .not('payment_intent_id', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
    }

    console.log(`[SYNC] Found ${bookings?.length || 0} bookings to check`);

    const results = {
      checked: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const booking of bookings || []) {
      results.checked++;
      
      try {
        // Get payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        
        console.log(`[SYNC] Booking ${booking.id}: Stripe status = ${paymentIntent.status}`);

        // If payment intent is authorized (requires_capture), update booking
        if (paymentIntent.status === 'requires_capture') {
          // Update booking status
          const { error: updateError } = await supabase
            .from('bookings')
            .update({
              status: 'confirmed',
              payment_status: 'authorized',
              updated_at: new Date().toISOString()
            })
            .eq('id', booking.id);

          if (updateError) {
            results.errors.push(`Failed to update booking ${booking.id}: ${updateError.message}`);
            continue;
          }

          // Create transaction record if missing
          const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('payment_intent_id', booking.payment_intent_id)
            .single();

          if (!existingTx) {
            const { error: txError } = await supabase
              .from('transactions')
              .insert({
                booking_id: booking.id,
                payment_intent_id: booking.payment_intent_id,
                amount: paymentIntent.amount / 100, // Convert cents to dollars
                status: 'authorized',
                transaction_type: 'authorization',
                payment_method: 'card',
                currency: paymentIntent.currency.toUpperCase()
              });

            if (txError) {
              console.error(`[SYNC] Failed to create transaction for ${booking.id}:`, txError);
            }
          }

          results.updated++;
          console.log(`[SYNC] ✅ Updated booking ${booking.id} to payment_authorized`);
        } else {
          results.skipped++;
          console.log(`[SYNC] ⏭️ Skipped booking ${booking.id} (status: ${paymentIntent.status})`);
        }
      } catch (error) {
        results.errors.push(`Error processing booking ${booking.id}: ${error.message}`);
        console.error(`[SYNC] ❌ Error for booking ${booking.id}:`, error);
      }
    }

    console.log('[SYNC] Sync completed:', results);

    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[SYNC] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
