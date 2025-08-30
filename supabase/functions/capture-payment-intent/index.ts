
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
    const { bookingId, capturedBy } = await req.json();

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

    console.log(`Starting payment capture for booking ${bookingId}`);

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking not found:", bookingError);
      throw new Error("Booking not found");
    }

    if (!booking.payment_intent_id) {
      throw new Error("No payment intent found for this booking");
    }

    console.log(`Found booking with payment intent: ${booking.payment_intent_id}`);

    // Capture the payment intent
    const paymentIntent = await stripe.paymentIntents.capture(booking.payment_intent_id);
    
    console.log(`Payment intent captured successfully: ${paymentIntent.status}`);

    // Update booking to completed status (this will trigger auto-archiving)
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'completed',
        status: 'completed' // Changed from 'confirmed' to 'completed' to trigger archiving
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error("Error updating booking status:", updateError);
      throw updateError;
    }

    // Record the capture transaction
    const { error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        booking_id: bookingId,
        amount: paymentIntent.amount / 100, // Convert from cents
        status: 'completed',
        payment_intent_id: booking.payment_intent_id,
        transaction_type: 'capture',
        payment_method: 'card',
        captured_by: capturedBy,
        captured_at: new Date().toISOString(),
        currency: paymentIntent.currency.toUpperCase()
      });

    if (transactionError) {
      console.error("Error recording capture transaction:", transactionError);
      // Don't throw here as the main operation succeeded
    }

    // Log the capture
    await supabaseAdmin
      .from('sms_logs')
      .insert({
        booking_id: bookingId,
        recipient_number: 'system',
        message: `Payment captured and booking completed - will be auto-archived`,
        status: 'sent'
      });

    console.log(`Payment capture completed for booking ${bookingId}`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
        },
        booking_status: 'completed',
        will_archive: true
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error capturing payment:", error);
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
