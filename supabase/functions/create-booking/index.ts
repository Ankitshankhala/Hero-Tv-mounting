import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-BOOKING] ${step}${detailsStr}`);
};

// Utility function to validate UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      transaction_id, 
      booking_payload 
    } = await req.json();
    
    logStep("Function started", { 
      transaction_id, 
      booking_payload: !!booking_payload 
    });

    // Input validation
    if (!transaction_id || !isValidUUID(transaction_id)) {
      throw new Error('Invalid transaction_id: must be a valid UUID');
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

    // Step 1: Validate transaction exists and is in authorized state
    logStep("Validating transaction", { transaction_id });
    const { data: transaction, error: transactionError } = await supabaseServiceRole
      .from('transactions')
      .select('id, status, payment_intent_id, booking_id, amount, guest_customer_email')
      .eq('id', transaction_id)
      .single();

    if (transactionError || !transaction) {
      logStep("Transaction not found", { error: transactionError });
      throw new Error('Transaction not found');
    }

    // Validate transaction is in authorized state and has no booking yet
    if (transaction.status !== 'authorized') {
      logStep("Transaction not authorized", { 
        transaction_id, 
        status: transaction.status 
      });
      throw new Error(`Transaction not authorized. Current status: ${transaction.status}`);
    }

    if (transaction.booking_id !== null) {
      logStep("Transaction already has booking", { 
        transaction_id, 
        existing_booking_id: transaction.booking_id 
      });
      throw new Error('Transaction already associated with a booking');
    }

    logStep("Transaction validation passed", { 
      transaction_id, 
      payment_intent_id: transaction.payment_intent_id,
      amount: transaction.amount 
    });

    // Step 2: Create the booking record
    logStep("Creating booking record", { booking_payload });
    
    const bookingInsert = {
      ...booking_payload,
      status: 'authorized', // Booking is authorized since payment is authorized
      payment_status: 'authorized',
      payment_intent_id: transaction.payment_intent_id,
      // Handle guest vs authenticated user
      customer_id: booking_payload.customer_id || null,
      guest_customer_info: booking_payload.guest_customer_info || null,
    };

    // For guest bookings, ensure we have the guest email from transaction
    if (!bookingInsert.customer_id && transaction.guest_customer_email) {
      if (!bookingInsert.guest_customer_info) {
        bookingInsert.guest_customer_info = {};
      }
      bookingInsert.guest_customer_info.email = transaction.guest_customer_email;
    }

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
    logStep("Updating transaction with booking_id", { transaction_id, booking_id: bookingId });
    const { error: updateError } = await supabaseServiceRole
      .from('transactions')
      .update({ booking_id: bookingId })
      .eq('id', transaction_id);

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
      transaction_id: transaction_id,
      payment_intent_id: transaction.payment_intent_id,
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
    if (errorMessage.includes('Invalid transaction_id') || 
        errorMessage.includes('booking_payload') ||
        errorMessage.includes('required') ||
        errorMessage.includes('Transaction not found') ||
        errorMessage.includes('Transaction not authorized') ||
        errorMessage.includes('already associated')) {
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