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
  console.log(`[CLEANUP-ORPHANED-TRANSACTIONS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting cleanup of orphaned transactions");

    // Initialize Supabase client with service role
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Find transactions older than 30 minutes with no booking
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    logStep("Querying for orphaned transactions", { cutoff_time: thirtyMinutesAgo });
    
    const { data: orphanedTransactions, error: queryError } = await supabaseServiceRole
      .from('transactions')
      .select('id, payment_intent_id, status, amount, created_at')
      .is('booking_id', null)
      .lt('created_at', thirtyMinutesAgo)
      .in('status', ['pending', 'requires_payment_method', 'requires_confirmation']);

    if (queryError) {
      throw new Error(`Failed to query orphaned transactions: ${queryError.message}`);
    }

    if (!orphanedTransactions || orphanedTransactions.length === 0) {
      logStep("No orphaned transactions found");
      return new Response(JSON.stringify({
        success: true,
        cleaned_count: 0,
        message: 'No orphaned transactions to clean up'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    logStep("Found orphaned transactions", { count: orphanedTransactions.length });

    let cleanupCount = 0;
    let stripeErrors = 0;

    // Process each orphaned transaction
    for (const transaction of orphanedTransactions) {
      try {
        logStep("Processing orphaned transaction", { 
          transaction_id: transaction.id,
          payment_intent_id: transaction.payment_intent_id,
          status: transaction.status,
          age_minutes: Math.round((Date.now() - new Date(transaction.created_at).getTime()) / (1000 * 60))
        });

        // Cancel payment intent in Stripe if it exists
        if (transaction.payment_intent_id) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(transaction.payment_intent_id);
            
            // Only cancel if it's still cancelable
            if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status)) {
              await stripe.paymentIntents.cancel(transaction.payment_intent_id);
              logStep("Cancelled payment intent in Stripe", { payment_intent_id: transaction.payment_intent_id });
            } else {
              logStep("Payment intent not cancelable", { 
                payment_intent_id: transaction.payment_intent_id,
                status: paymentIntent.status 
              });
            }
          } catch (stripeError) {
            logStep("Failed to cancel payment intent in Stripe", { 
              payment_intent_id: transaction.payment_intent_id,
              error: stripeError 
            });
            stripeErrors++;
          }
        }

        // Delete transaction from database
        const { error: deleteError } = await supabaseServiceRole
          .from('transactions')
          .delete()
          .eq('id', transaction.id);

        if (deleteError) {
          logStep("Failed to delete transaction", { 
            transaction_id: transaction.id,
            error: deleteError 
          });
        } else {
          cleanupCount++;
          logStep("Successfully cleaned up transaction", { transaction_id: transaction.id });
        }

      } catch (transactionError) {
        logStep("Error processing transaction", { 
          transaction_id: transaction.id,
          error: transactionError 
        });
      }
    }

    const response = {
      success: true,
      total_found: orphanedTransactions.length,
      cleaned_count: cleanupCount,
      stripe_errors: stripeErrors,
      message: `Cleaned up ${cleanupCount} of ${orphanedTransactions.length} orphaned transactions`
    };

    logStep("Cleanup completed", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cleanup-orphaned-transactions", { error: errorMessage });

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

/**
 * Usage Examples:
 * 
 * 1. Manual cleanup via HTTP call:
 *    POST https://your-project.supabase.co/functions/v1/cleanup-orphaned-transactions
 * 
 * 2. Scheduled cleanup via cron (add to your cron service):
 *    curl -X POST https://your-project.supabase.co/functions/v1/cleanup-orphaned-transactions \
 *      -H "Authorization: Bearer YOUR_ANON_KEY"
 * 
 * 3. Database function to call this (optional):
 *    CREATE OR REPLACE FUNCTION public.cleanup_orphaned_transactions()
 *    RETURNS void
 *    LANGUAGE plpgsql
 *    SECURITY DEFINER
 *    AS $$
 *    BEGIN
 *      PERFORM pg_net.http_post(
 *        url := 'https://your-project.supabase.co/functions/v1/cleanup-orphaned-transactions',
 *        headers := jsonb_build_object('Authorization', 'Bearer ' || get_secret('SUPABASE_ANON_KEY'))
 *      );
 *    END;
 *    $$;
 */