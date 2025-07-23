import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { IdempotencyManager } from "../shared/idempotency.ts";
import { mapStripeStatus } from "../shared/status-mapping.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLEANUP-UNPAID-BOOKINGS] ${step}${detailsStr}`);
};

// Configuration for cleanup timeouts
const CLEANUP_CONFIG = {
  BOOKING_TIMEOUT_MINUTES: 30,
  IDEMPOTENCY_TIMEOUT_MINUTES: 60,
  BATCH_SIZE: 50,
  MAX_CONCURRENT_STRIPE_CALLS: 5
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting cleanup of unpaid bookings");

    // Initialize services
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const idempotencyManager = new IdempotencyManager(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Step 1: Cleanup expired idempotency records
    logStep("Starting idempotency records cleanup");
    const idempotencyCleanupCount = await idempotencyManager.cleanupExpiredRecords();
    logStep(`Cleaned up ${idempotencyCleanupCount} expired idempotency records`);

    // Step 2: Find and cleanup abandoned bookings
    const timeoutCutoff = new Date(Date.now() - CLEANUP_CONFIG.BOOKING_TIMEOUT_MINUTES * 60 * 1000).toISOString();
    
    
    logStep("Finding abandoned bookings", { olderThan: timeoutCutoff });
    
    const { data: abandonedBookings, error: bookingError } = await supabaseServiceRole
      .from('bookings')
      .select('id, payment_intent_id, created_at, customer_id')
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .lt('created_at', timeoutCutoff)
      .limit(CLEANUP_CONFIG.BATCH_SIZE);

    if (bookingError) {
      throw new Error(`Failed to fetch abandoned bookings: ${bookingError.message}`);
    }

    if (!abandonedBookings || abandonedBookings.length === 0) {
      logStep("No abandoned bookings found");
      return new Response(JSON.stringify({
        success: true,
        cleaned_bookings: 0,
        cleaned_idempotency: idempotencyCleanupCount,
        stripe_cancelled: 0,
        message: 'No abandoned bookings found, but cleaned idempotency records'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    logStep(`Found ${abandonedBookings.length} abandoned bookings to clean up`);

    let cleanupCount = 0;
    let stripeCleanupCount = 0;
    let stripeErrors = 0;

    // Process bookings in batches to avoid overwhelming Stripe API
    const processStripePromises = [];
    
    for (const booking of abandonedBookings) {
      const processBooking = async () => {
        try {
          logStep(`Processing abandoned booking`, { 
            booking_id: booking.id, 
            created_at: booking.created_at,
            customer_id: booking.customer_id
          });

          let stripeStatus = null;
          
          // Check and cancel Stripe payment intent if it exists
          if (booking.payment_intent_id) {
            try {
              // First, check the current status of the payment intent
              const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
              stripeStatus = paymentIntent.status;
              
              logStep("Retrieved payment intent status", { 
                payment_intent_id: booking.payment_intent_id,
                status: stripeStatus 
              });

              // Only cancel if it's still cancelable
              if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(stripeStatus)) {
                await stripe.paymentIntents.cancel(booking.payment_intent_id);
                stripeCleanupCount++;
                logStep("Cancelled Stripe payment intent", { payment_intent_id: booking.payment_intent_id });
              } else {
                logStep("Payment intent not cancelable", { 
                  payment_intent_id: booking.payment_intent_id,
                  status: stripeStatus 
                });
              }
            } catch (stripeError) {
              stripeErrors++;
              logStep("Failed to process Stripe payment intent", { 
                payment_intent_id: booking.payment_intent_id, 
                error: stripeError.message 
              });
              // Continue with booking cleanup even if Stripe fails
            }
          }

          // Determine appropriate status based on Stripe status
          const finalStatus = stripeStatus === 'succeeded' ? 'completed' : 'cancelled';
          const finalPaymentStatus = stripeStatus === 'succeeded' ? 'paid' : 'expired';

          // Update booking status
          const { error: updateError } = await supabaseServiceRole
            .from('bookings')
            .update({ 
              status: finalStatus,
              payment_status: finalPaymentStatus
            })
            .eq('id', booking.id);

          if (updateError) {
            logStep("Failed to update booking status", { booking_id: booking.id, error: updateError });
            return;
          }

          // Update transaction status if it exists
          if (booking.payment_intent_id) {
            const transactionStatus = stripeStatus === 'succeeded' ? 'paid' : 'expired';
            await supabaseServiceRole
              .from('transactions')
              .update({ 
                status: transactionStatus,
                cancellation_reason: stripeStatus === 'succeeded' ? null : 'payment_timeout',
                cancelled_at: stripeStatus === 'succeeded' ? null : new Date().toISOString()
              })
              .eq('payment_intent_id', booking.payment_intent_id);
          }

          cleanupCount++;
          logStep("Successfully processed booking", { 
            booking_id: booking.id,
            final_status: finalStatus,
            stripe_status: stripeStatus
          });

        } catch (error) {
          logStep("Error processing individual booking", { 
            booking_id: booking.id, 
            error: error.message 
          });
          // Continue with other bookings
        }
      };

      processStripePromises.push(processBooking());
      
      // Process in batches to avoid rate limiting
      if (processStripePromises.length >= CLEANUP_CONFIG.MAX_CONCURRENT_STRIPE_CALLS) {
        await Promise.allSettled(processStripePromises);
        processStripePromises.length = 0; // Clear array
      }
    }

    // Process remaining promises
    if (processStripePromises.length > 0) {
      await Promise.allSettled(processStripePromises);
    }

    const response = {
      success: true,
      cleaned_bookings: cleanupCount,
      cleaned_idempotency: idempotencyCleanupCount,
      stripe_cancelled: stripeCleanupCount,
      stripe_errors: stripeErrors,
      total_found: abandonedBookings.length,
      message: `Cleaned up ${cleanupCount} abandoned bookings and ${idempotencyCleanupCount} idempotency records`
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