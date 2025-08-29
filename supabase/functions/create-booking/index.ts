import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging function
const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-BOOKING] ${step}${detailsStr}`);
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      user_id,
      payment_intent_id,
      booking_payload
    } = await req.json();
    
    logStep("Function started", {
      payment_intent_id,
      booking_payload: !!booking_payload,
      has_user: !!user_id
    });

    // Allow both authenticated and guest bookings
    logStep("Processing booking", { 
      is_authenticated: !!user_id,
      booking_type: user_id ? 'authenticated' : 'guest'
    });

    // Input validation
    if (!payment_intent_id || typeof payment_intent_id !== 'string') {
      throw new Error('payment_intent_id is required and must be a string');
    }

    if (!booking_payload || typeof booking_payload !== 'object') {
      throw new Error('booking_payload is required and must be an object');
    }

    // Validate required booking fields
    const requiredFields = ['service_id', 'scheduled_date', 'scheduled_start'];
    for (const field of requiredFields) {
      if (!booking_payload[field]) {
        throw new Error(`booking_payload.${field} is required`);
      }
    }

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Step 1: Find pending transaction for the payment intent
    logStep("Looking up transaction", { payment_intent_id });
    const { data: transaction, error: transactionError } = await supabaseServiceRole
      .from('transactions')
      .select('id, status')
      .eq('payment_intent_id', payment_intent_id)
      .eq('status', 'pending')
      .single();

    if (transactionError || !transaction) {
      logStep("Transaction not found", { error: transactionError });
      return new Response(JSON.stringify({ error: 'Transaction not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    logStep("Transaction found", { transaction_id: transaction.id });

    // Step 2: Create the booking record
    logStep("Creating booking record", { booking_payload });
    
    const bookingInsert = {
      ...booking_payload,
      status: 'payment_pending',
      payment_status: 'pending',
      payment_intent_id,
      customer_id: null,
    };


    const { data: newBooking, error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .insert(bookingInsert)
      .select('id, status, payment_status')
      .single();

    if (bookingError) {
      logStep("Booking creation failed", { error: bookingError });
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    const bookingId = newBooking.id;
    logStep("Booking created successfully", { 
      booking_id: bookingId,
      status: newBooking.status,
      payment_status: newBooking.payment_status 
    });

    // Step 3: Update transaction with booking_id
    logStep("Updating transaction with booking_id", { transaction_id: transaction.id, booking_id: bookingId });
    const { error: updateError } = await supabaseServiceRole
      .from('transactions')
      .update({ booking_id: bookingId })
      .eq('id', transaction.id);

    if (updateError) {
      logStep("Failed to update transaction with booking_id", { error: updateError });
      
      // Try to clean up the booking we just created
      try {
        await supabaseServiceRole
          .from('bookings')
          .delete()
          .eq('id', bookingId);
        logStep("Cleaned up booking after transaction update failure");
      } catch (cleanupError) {
        logStep("Failed to cleanup booking", { cleanupError });
      }
      
      throw new Error(`Failed to link booking to transaction: ${updateError.message}`);
    }

    logStep("Transaction updated successfully");

    const response = {
      success: true,
      booking_id: bookingId,
      transaction_id: transaction.id,
      payment_intent_id,
      status: newBooking.status,
      payment_status: newBooking.payment_status,
    };

    logStep("Booking creation completed successfully", response);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-booking", { error: errorMessage });
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('payment_intent_id') ||
        errorMessage.includes('booking_payload') ||
        errorMessage.includes('Authenticated bookings') ||
        errorMessage.includes('required')) {
      statusCode = 400;
    }

    return new Response(JSON.stringify({
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    });
  }
});