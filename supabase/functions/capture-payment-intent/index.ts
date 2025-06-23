
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
    const { bookingId } = await req.json();

    if (!bookingId) {
      throw new Error('Missing required field: bookingId');
    }

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get booking with payment intent ID
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('payment_intent_id, payment_status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    if (!booking.payment_intent_id) {
      throw new Error('No payment intent found for this booking');
    }

    if (booking.payment_status === 'captured') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment already captured',
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Capture the payment intent
    const paymentIntent = await stripe.paymentIntents.capture(booking.payment_intent_id);

    // Update booking status based on capture result
    let newStatus = 'captured';
    let newPaymentStatus = 'captured';

    if (paymentIntent.status === 'succeeded') {
      // Create transaction record
      await supabaseAdmin.from('transactions').insert({
        booking_id: bookingId,
        payment_intent_id: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert from cents
        status: 'success',
        payment_method: 'card',
        transaction_type: 'capture',
      });
    } else {
      newStatus = 'pending';
      newPaymentStatus = 'failed';
    }

    // Update booking
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status: newStatus,
        payment_status: newPaymentStatus
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Failed to update booking:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_status: paymentIntent.status,
        amount_captured: paymentIntent.amount / 100,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error capturing payment:', error);
    
    // Handle specific Stripe errors
    let errorMessage = 'Payment capture failed';
    if (error instanceof Error) {
      if (error.message.includes('cannot be captured')) {
        errorMessage = 'Payment authorization has expired. Please create a new booking.';
      } else if (error.message.includes('insufficient_funds')) {
        errorMessage = 'Insufficient funds on the payment method.';
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
