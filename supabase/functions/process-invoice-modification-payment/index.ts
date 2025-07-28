import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, paymentMethodId } = await req.json();

    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(name, email)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    const pendingAmount = booking.pending_payment_amount || 0;

    if (pendingAmount <= 0) {
      throw new Error("No pending payment amount for this booking");
    }

    let paymentIntent;

    if (paymentMethodId) {
      // Process immediate charge with provided payment method
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(pendingAmount * 100), // Convert to cents
        currency: "usd",
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        metadata: {
          booking_id: bookingId,
          type: "invoice_modification",
        },
        description: `Invoice modification for booking ${bookingId.slice(0, 8)}`,
      });
    } else {
      // Create payment intent for later confirmation
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(pendingAmount * 100), // Convert to cents
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          booking_id: bookingId,
          type: "invoice_modification",
        },
        description: `Invoice modification for booking ${bookingId.slice(0, 8)}`,
      });
    }

    // Update booking with payment intent
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_intent_id: paymentIntent.id,
        payment_status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending'
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error("Error updating booking:", updateError);
      throw updateError;
    }

    // Log the modification payment
    await supabaseAdmin
      .from('invoice_service_modifications')
      .insert({
        booking_id: bookingId,
        worker_id: booking.worker_id,
        modification_type: 'payment',
        service_name: 'Payment Processing',
        price_change: pendingAmount
      });

    console.log(`Payment intent created for booking ${bookingId}: ${paymentIntent.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          status: paymentIntent.status,
        },
        amount: pendingAmount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing invoice modification payment:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});