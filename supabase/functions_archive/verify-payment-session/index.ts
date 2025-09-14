import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting payment session verification');
    
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Retrieving Stripe session', { sessionId });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    logStep('Session retrieved', { 
      status: session.payment_status,
      paymentIntentId: session.payment_intent 
    });

    // Update transaction status based on session
    if (session.payment_intent && session.payment_status === 'paid') {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'completed',
          captured_at: new Date().toISOString()
        })
        .eq('payment_intent_id', session.payment_intent);

      if (updateError) {
        logStep('Failed to update transaction', { error: updateError });
      } else {
        logStep('Transaction updated to completed');
      }
    }

    return new Response(JSON.stringify({
      success: true,
      status: session.payment_status,
      paymentIntentId: session.payment_intent,
      transactionId: session.payment_intent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error verifying payment session', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});