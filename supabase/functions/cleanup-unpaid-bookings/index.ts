import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLEANUP-UNPAID-BOOKINGS] ${step}${detailsStr}`);
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

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Find bookings older than 30 minutes that are still pending payment
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    logStep("Finding abandoned bookings", { olderThan: thirtyMinutesAgo });
    
    const { data: abandonedBookings, error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .select('id, payment_intent_id, created_at')
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .lt('created_at', thirtyMinutesAgo)
      .limit(50); // Process in batches

    if (bookingError) {
      throw new Error(`Failed to fetch abandoned bookings: ${bookingError.message}`);
    }

    if (!abandonedBookings || abandonedBookings.length === 0) {
      logStep("No abandoned bookings found");
      return new Response(JSON.stringify({
        success: true,
        cleaned_count: 0,
        message: 'No abandoned bookings found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    logStep(`Found ${abandonedBookings.length} abandoned bookings to clean up`);

    let cleanupCount = 0;
    let stripeCleanupCount = 0;

    for (const booking of abandonedBookings) {
      try {
        logStep(`Cleaning up booking`, { booking_id: booking.id, created_at: booking.created_at });

        // Cancel Stripe payment intent if it exists
        if (booking.payment_intent_id) {
          try {
            await stripe.paymentIntents.cancel(booking.payment_intent_id);
            stripeCleanupCount++;
            logStep("Cancelled Stripe payment intent", { payment_intent_id: booking.payment_intent_id });
          } catch (stripeError) {
            logStep("Failed to cancel Stripe payment intent", { 
              payment_intent_id: booking.payment_intent_id, 
              error: stripeError.message 
            });
            // Continue with booking cleanup even if Stripe fails
          }
        }

        // Update booking status to cancelled
        const { error: updateError } = await supabaseServiceRole
          .from('bookings')
          .update({ 
            status: 'cancelled',
            payment_status: 'expired'
          })
          .eq('id', booking.id);

        if (updateError) {
          logStep("Failed to update booking status", { booking_id: booking.id, error: updateError });
          continue;
        }

        // Update transaction status if it exists
        if (booking.payment_intent_id) {
          await supabaseServiceRole
            .from('transactions')
            .update({ 
              status: 'expired',
              cancellation_reason: 'payment_timeout',
              cancelled_at: new Date().toISOString()
            })
            .eq('payment_intent_id', booking.payment_intent_id);
        }

        cleanupCount++;
        logStep("Successfully cleaned up booking", { booking_id: booking.id });

      } catch (error) {
        logStep("Error cleaning up individual booking", { 
          booking_id: booking.id, 
          error: error.message 
        });
        // Continue with other bookings
      }
    }

    const response = {
      success: true,
      cleaned_count: cleanupCount,
      stripe_cancelled_count: stripeCleanupCount,
      total_found: abandonedBookings.length,
      message: `Cleaned up ${cleanupCount} abandoned bookings`
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