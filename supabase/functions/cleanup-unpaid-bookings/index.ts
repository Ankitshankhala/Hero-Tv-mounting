import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLEANUP-UNPAID] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting cleanup of unpaid bookings");

    // Initialize Supabase client with service role for database operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Find bookings that are older than 30 minutes and still pending payment
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    logStep("Searching for unpaid bookings", { cutoff: thirtyMinutesAgo });

    const { data: unpaidBookings, error: searchError } = await supabaseServiceRole
      .from('bookings')
      .select('id, created_at, payment_intent_id')
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .lt('created_at', thirtyMinutesAgo);

    if (searchError) {
      logStep("Failed to search for unpaid bookings", { error: searchError });
      throw new Error(`Failed to search for unpaid bookings: ${searchError.message}`);
    }

    if (!unpaidBookings || unpaidBookings.length === 0) {
      logStep("No unpaid bookings found to cleanup");
      return new Response(JSON.stringify({
        success: true,
        cleaned_up: 0,
        message: 'No unpaid bookings found to cleanup'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    logStep("Found unpaid bookings to cleanup", { count: unpaidBookings.length });

    let cleanedUp = 0;
    let errors = [];

    // Process each unpaid booking
    for (const booking of unpaidBookings) {
      try {
        logStep("Cleaning up booking", { booking_id: booking.id });

        // Update booking status to cancelled
        const { error: updateError } = await supabaseServiceRole
          .from('bookings')
          .update({ 
            status: 'cancelled',
            payment_status: 'expired'
          })
          .eq('id', booking.id);

        if (updateError) {
          logStep("Failed to update booking", { booking_id: booking.id, error: updateError });
          errors.push(`Failed to update booking ${booking.id}: ${updateError.message}`);
          continue;
        }

        // Update related transactions if they exist
        if (booking.payment_intent_id) {
          const { error: transactionError } = await supabaseServiceRole
            .from('transactions')
            .update({ 
              status: 'expired',
              cancellation_reason: 'automatic_cleanup_unpaid',
              cancelled_at: new Date().toISOString()
            })
            .eq('payment_intent_id', booking.payment_intent_id);

          if (transactionError) {
            logStep("Failed to update transaction", { 
              booking_id: booking.id, 
              payment_intent_id: booking.payment_intent_id,
              error: transactionError 
            });
            // Don't add to errors array as booking cleanup was successful
          }
        }

        cleanedUp++;
        logStep("Successfully cleaned up booking", { booking_id: booking.id });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("Error cleaning up booking", { booking_id: booking.id, error: errorMessage });
        errors.push(`Error cleaning up booking ${booking.id}: ${errorMessage}`);
      }
    }

    const response = {
      success: true,
      cleaned_up: cleanedUp,
      total_found: unpaidBookings.length,
      errors: errors.length > 0 ? errors : undefined
    };

    logStep("Cleanup completed", response);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cleanup-unpaid-bookings", { error: errorMessage });
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});