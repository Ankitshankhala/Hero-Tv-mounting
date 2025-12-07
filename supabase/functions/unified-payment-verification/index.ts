import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    
    const { 
      paymentIntentId, 
      bookingId, 
      verificationType = 'intent',
      syncStatuses = true 
    } = await req.json();

    if (!paymentIntentId) {
      throw new Error('paymentIntentId is required');
    }

    console.log(`[UNIFIED-PAYMENT-VERIFICATION] Verifying PI: ${paymentIntentId}, Type: ${verificationType}`);

    // Fetch payment intent from Stripe
    let stripeStatus = 'unknown';
    let requiresCapture = false;
    let amountReceived = 0;

    if (STRIPE_SECRET_KEY) {
      try {
        const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
          headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` }
        });

        if (response.ok) {
          const paymentIntent = await response.json();
          stripeStatus = paymentIntent.status;
          requiresCapture = paymentIntent.status === 'requires_capture';
          amountReceived = (paymentIntent.amount_received || paymentIntent.amount || 0) / 100;
          
          console.log(`[UNIFIED-PAYMENT-VERIFICATION] Stripe status: ${stripeStatus}, Amount: ${amountReceived}`);
        }
      } catch (stripeError) {
        console.error('[UNIFIED-PAYMENT-VERIFICATION] Stripe fetch error:', stripeError);
      }
    }

    // Find or create transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_intent_id', paymentIntentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let transactionId = transaction?.id;
    let localStatus = transaction?.status || 'pending';

    // Sync statuses if requested
    if (syncStatuses && transaction) {
      let newStatus = localStatus;
      
      if (stripeStatus === 'succeeded') {
        newStatus = 'completed';
      } else if (stripeStatus === 'requires_capture') {
        newStatus = 'authorized';
      } else if (stripeStatus === 'canceled') {
        newStatus = 'cancelled';
      }

      if (newStatus !== localStatus) {
        await supabase
          .from('transactions')
          .update({ 
            status: newStatus,
            amount: amountReceived || transaction.amount
          })
          .eq('id', transaction.id);

        localStatus = newStatus;
        console.log(`[UNIFIED-PAYMENT-VERIFICATION] Updated transaction status: ${newStatus}`);
      }

      // Sync booking status
      if (bookingId || transaction.booking_id) {
        const targetBookingId = bookingId || transaction.booking_id;
        
        let paymentStatus = 'pending';
        if (newStatus === 'completed') {
          paymentStatus = 'captured';
        } else if (newStatus === 'authorized') {
          paymentStatus = 'authorized';
        }

        await supabase
          .from('bookings')
          .update({ payment_status: paymentStatus })
          .eq('id', targetBookingId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      stripeStatus,
      localStatus,
      requiresCapture,
      transactionId,
      amountReceived,
      synced: syncStatuses
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[UNIFIED-PAYMENT-VERIFICATION] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
