import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BOOKING-STATUS-CHECK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { booking_id, payment_intent_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    logStep("Checking booking status consistency", { booking_id, payment_intent_id });

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, status, payment_status, payment_intent_id')
      .eq('id', booking_id)
      .single();

    if (bookingError) {
      logStep("Booking not found", { error: bookingError.message });
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    logStep("Current booking state", booking);

    // Get transaction details if payment_intent_id provided
    let transaction = null;
    if (payment_intent_id) {
      const { data: transactionData, error: transactionError } = await supabaseClient
        .from('transactions')
        .select('id, status, payment_intent_id, booking_id')
        .eq('payment_intent_id', payment_intent_id)
        .single();

      if (!transactionError) {
        transaction = transactionData;
        logStep("Current transaction state", transaction);
      }
    }

    // Check for inconsistencies and fix them
    let fixesApplied = [];
    let needsUpdate = false;
    let updates = {};

    // If booking has payment_intent but status is still pending
    if (booking.payment_intent_id && booking.status === 'pending') {
      // Check if there's an authorized transaction first
      if (!transaction || transaction.status !== 'authorized') {
        needsUpdate = true;
        updates.status = 'payment_pending';
        updates.payment_status = 'pending';
        fixesApplied.push('Updated status from pending to payment_pending');
      }
    }

    // If transaction is authorized but booking is not confirmed (treat authorized as confirmed)
    if (transaction && transaction.status === 'authorized' && !['confirmed', 'payment_authorized'].includes(booking.status)) {
      needsUpdate = true;
      updates.status = 'confirmed';
      updates.payment_status = 'authorized';
      fixesApplied.push('Updated booking to confirmed status for authorized payment');
    }

    // If transaction is completed but booking is not confirmed
    if (transaction && transaction.status === 'completed' && booking.status !== 'confirmed') {
      needsUpdate = true;
      updates.status = 'confirmed';
      updates.payment_status = 'completed';
      fixesApplied.push('Updated booking to match completed transaction');
    }

    // Apply fixes if needed
    if (needsUpdate) {
      logStep("Applying consistency fixes", { updates, fixes: fixesApplied });
      
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update(updates)
        .eq('id', booking_id);

      if (updateError) {
        logStep("Failed to apply fixes", { error: updateError.message });
        return new Response(
          JSON.stringify({ 
            error: 'Failed to apply consistency fixes',
            details: updateError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logStep("Consistency fixes applied successfully", { fixes: fixesApplied });
    } else {
      logStep("No consistency issues found");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        booking_status: needsUpdate ? updates.status : booking.status,
        payment_status: needsUpdate ? updates.payment_status : booking.payment_status,
        fixes_applied: fixesApplied,
        consistent: !needsUpdate
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logStep("ERROR in booking-status-consistency-check", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});