import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateTransactionRequest {
  payment_intent_id: string;
  status: 'authorized' | 'paid' | 'failed' | 'requires_capture' | 'succeeded' | 'completed';
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UPDATE-TRANSACTION-STATUS] ${step}${detailsStr}`);
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

    const { payment_intent_id, status }: UpdateTransactionRequest = await req.json();

    if (!payment_intent_id || !status) {
      logStep("Missing required parameters", { payment_intent_id, status });
      return new Response(
        JSON.stringify({ error: 'payment_intent_id and status are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Enhanced status normalization to handle all Stripe statuses
    let normalizedStatus: string;
    const lowerStatus = status.toLowerCase().trim();
    
    logStep('Normalizing status', { originalStatus: status, lowerStatus });
    
    switch (lowerStatus) {
      case 'requires_capture':
      case 'authorized':
        normalizedStatus = 'authorized';
        break;
      case 'succeeded':
      case 'completed':
      case 'paid':
        normalizedStatus = 'completed';
        break;
      case 'captured':
        normalizedStatus = 'captured';
        break;
      case 'canceled':
      case 'cancelled':
      case 'failed':
      case 'payment_failed':
        normalizedStatus = 'failed';
        break;
      case 'processing':
      case 'requires_action':
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'pending':
        normalizedStatus = 'pending';
        break;
      default:
        // For unknown statuses, attempt to keep them if they're valid enum values
        const validStatuses = ['pending', 'authorized', 'completed', 'failed', 'captured'];
        if (validStatuses.includes(lowerStatus)) {
          normalizedStatus = lowerStatus;
        } else {
          logStep('Unknown status, defaulting to failed', { unknownStatus: status });
          normalizedStatus = 'failed';
        }
        break;
    }
    
    logStep('Status normalized', { originalStatus: status, normalizedStatus });

    logStep("Updating transaction status", { 
      payment_intent_id, 
      original_status: status, 
      normalized_status: normalizedStatus 
    });

    // Find the transaction
    const { data: transaction, error: findError } = await supabaseClient
      .from('transactions')
      .select('id, status, booking_id')
      .eq('payment_intent_id', payment_intent_id)
      .single();

    if (findError) {
      logStep("Transaction not found", { error: findError.message });
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    logStep("Found transaction", { transaction_id: transaction.id, current_status: transaction.status });

    // Step 1: Ensure booking is in correct status before transaction update
    if (transaction.booking_id) {
      let bookingStatus: string | undefined;
      let paymentStatus: string;

      if (normalizedStatus === 'authorized') {
        bookingStatus = 'payment_authorized';
        paymentStatus = 'authorized';
      } else if (normalizedStatus === 'completed' || normalizedStatus === 'captured') {
        bookingStatus = 'confirmed';
        paymentStatus = normalizedStatus === 'completed' ? 'completed' : 'captured';
      } else if (normalizedStatus === 'failed') {
        bookingStatus = 'failed';
        paymentStatus = 'failed';
      } else if (normalizedStatus === 'pending') {
        bookingStatus = 'payment_pending';
        paymentStatus = 'pending';
      }

      if (bookingStatus) {
        logStep("Ensuring booking status is compatible", { 
          booking_id: transaction.booking_id, 
          target_status: bookingStatus,
          payment_status: paymentStatus
        });
        
        // Get current booking to check status
        const { data: currentBooking } = await supabaseClient
          .from('bookings')
          .select('status, payment_status')
          .eq('id', transaction.booking_id)
          .single();

        logStep("Current booking status", { current_booking: currentBooking });
        
        // Only update if the booking isn't already in the correct status
        if (currentBooking && currentBooking.status !== bookingStatus) {
          // Ensure booking status transition is valid for the trigger
          let validTransition = true;
          const currentStatus = currentBooking.status;
          
          // Check for valid transitions to avoid trigger violations
          if (bookingStatus === 'payment_authorized' && 
              !['pending', 'payment_pending'].includes(currentStatus)) {
            logStep("Invalid transition attempted", { 
              from: currentStatus, 
              to: bookingStatus,
              action: "Setting to payment_pending first"
            });
            
            // First set to payment_pending if coming from an invalid state
            await supabaseClient
              .from('bookings')
              .update({
                status: 'payment_pending',
                payment_status: 'pending'
              })
              .eq('id', transaction.booking_id);
              
            logStep("Booking status reset to payment_pending");
          }
          
          const { error: bookingUpdateError } = await supabaseClient
            .from('bookings')
            .update({
              status: bookingStatus,
              payment_status: paymentStatus
            })
            .eq('id', transaction.booking_id);

          if (bookingUpdateError) {
            logStep("Failed to update booking status", { error: bookingUpdateError.message });
            // Don't fail the entire operation, continue with transaction update
          } else {
            logStep("Booking status updated successfully", { 
              booking_id: transaction.booking_id, 
              old_status: currentStatus,
              new_status: bookingStatus 
            });
          }
        } else {
          logStep("Booking already in correct status", { 
            current_status: currentBooking?.status,
            target_status: bookingStatus
          });
        }
      }
    }

    // Step 2: Update transaction status with normalized status
    const { error: updateError } = await supabaseClient
      .from('transactions')
      .update({ status: normalizedStatus })
      .eq('payment_intent_id', payment_intent_id);

    if (updateError) {
      logStep("Failed to update transaction", { error: updateError.message });
      
      // For authorization flows, try a fallback approach
      if (normalizedStatus === 'authorized') {
        logStep("Attempting fallback for authorization flow");
        
        // Wait a moment for database consistency
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { error: retryError } = await supabaseClient
          .from('transactions')
          .update({ status: normalizedStatus })
          .eq('payment_intent_id', payment_intent_id);
          
        if (retryError) {
          logStep("Fallback also failed", { error: retryError.message });
          return new Response(
            JSON.stringify({ 
              error: 'Failed to update transaction status',
              details: retryError.message,
              success: false,
              requires_capture: normalizedStatus === 'authorized' // Indicate payment needs capture
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          logStep("Fallback succeeded for transaction update");
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to update transaction status' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    logStep("Transaction status updated successfully", {
      transaction_id: transaction.id,
      old_status: transaction.status,
      new_status: normalizedStatus,
      original_status: status,
      booking_id: transaction.booking_id
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: transaction.id,
        old_status: transaction.status,
        new_status: normalizedStatus
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logStep("ERROR in update-transaction-status", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});