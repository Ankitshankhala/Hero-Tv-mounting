
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
    const { bookingId, amount, customerEmail, customerName, requireAuth = false } = await req.json();

    console.log('🔄 Payment intent request:', { bookingId, amount, customerEmail, requireAuth });
    console.log('🔧 Environment check:', {
      hasStripeKey: !!Deno.env.get("STRIPE_SECRET_KEY"),
      stripeKeyType: Deno.env.get("STRIPE_SECRET_KEY")?.substring(0, 8) + '...',
      hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
      hasServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    });

    if (!bookingId || !amount) {
      throw new Error('Missing required fields: bookingId and amount');
    }

    // Handle test booking scenario
    if (bookingId === 'test-booking-id') {
      console.log('🧪 Test booking detected, returning mock response');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Test booking ID provided - this is expected for configuration testing",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Validate booking if provided (for existing bookings)
    // For new bookings, we skip this validation and create payment intent without booking validation
    let booking = null;
    if (bookingId && bookingId !== 'temp-booking-ref' && !bookingId.startsWith('temp-')) {
      const { data: bookingData, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('id, customer_id, status')
        .eq('id', bookingId)
        .single();

      if (bookingError) {
        console.error('❌ Booking validation error:', bookingError);
        throw new Error(`Invalid booking ID: ${bookingError.message}`);
      }

      if (!bookingData) {
        throw new Error('Booking not found');
      }

      booking = bookingData;
      console.log('✅ Booking validated:', booking);
    } else {
      console.log('✅ Creating payment intent for new booking (no existing booking to validate)');
    }

    // Initialize Stripe with secret key
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
    }
    
    console.log('🔧 Initializing Stripe with key type:', stripeSecretKey.substring(0, 8) + '...');
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Create customer in Stripe if needed
    let customer;
    if (customerEmail) {
      try {
        const existingCustomers = await stripe.customers.list({
          email: customerEmail,
          limit: 1,
        });

        if (existingCustomers.data.length > 0) {
          customer = existingCustomers.data[0];
          console.log('✅ Found existing Stripe customer:', customer.id);
        } else {
          customer = await stripe.customers.create({
            email: customerEmail,
            name: customerName,
          });
          console.log('✅ Created new Stripe customer:', customer.id);
        }
      } catch (stripeError: any) {
        console.error('⚠️ Stripe customer creation failed:', stripeError);
        // Continue without customer - payment can still work
      }
    }

    // Create PaymentIntent with manual capture for authorization (always manual for authorize-later model)
    console.log('🔄 Creating Stripe PaymentIntent...', {
      amount: Math.round(amount * 100),
      currency: "usd",
      customer: customer?.id,
      bookingId
    });
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      customer: customer?.id,
      capture_method: "manual", // Always manual for authorize now, capture later
      description: `Booking payment - ${bookingId}`,
      metadata: {
        booking_id: bookingId,
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    // Update booking with payment intent ID (only if we have a real booking)
    if (booking && bookingId !== 'temp-booking-ref' && !bookingId.startsWith('temp-')) {
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ 
          payment_intent_id: paymentIntent.id,
          stripe_customer_id: customer?.id,
          payment_status: 'pending'
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('❌ Failed to update booking:', updateError);
        // Don't fail the entire request, but log the error
        console.warn('⚠️ Booking update failed, but payment intent was created');
      } else {
        console.log('✅ Booking updated with payment intent');
      }
    } else {
      console.log('✅ Skipping booking update for temporary booking reference');
    }

    return new Response(
      JSON.stringify({
        success: true,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      type: error.type,
      code: error.code
    });
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error.type || 'server_error'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
