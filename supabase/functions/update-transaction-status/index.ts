import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateTransactionRequest {
  payment_intent_id: string;
  status: 'authorized' | 'paid' | 'failed';
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

    logStep("Updating transaction status", { payment_intent_id, status });

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

    // Step 1: Update booking status first (to satisfy validation triggers)
    if (transaction.booking_id) {
      let bookingStatus: string | undefined;
      let paymentStatus: string;

      if (status === 'authorized') {
        bookingStatus = 'payment_authorized';
        paymentStatus = 'authorized';
      } else if (status === 'completed' || status === 'captured') {
        bookingStatus = 'confirmed';
        paymentStatus = status;
      } else if (status === 'paid') {
        bookingStatus = 'confirmed';
        paymentStatus = 'completed';
      }

      if (bookingStatus) {
        logStep("Updating booking status first", { 
          booking_id: transaction.booking_id, 
          new_status: bookingStatus,
          payment_status: paymentStatus
        });
        
        // First get current booking to check status
        const { data: currentBooking } = await supabaseClient
          .from('bookings')
          .select('status, payment_status')
          .eq('id', transaction.booking_id)
          .single();

        logStep("Current booking status", { current_booking: currentBooking });
        
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
            status: bookingStatus 
          });
        }
      }
    }

    // Step 2: Update transaction status
    const { error: updateError } = await supabaseClient
      .from('transactions')
      .update({ status })
      .eq('payment_intent_id', payment_intent_id);

    if (updateError) {
      logStep("Failed to update transaction", { error: updateError.message });
      
      // For authorization flows, try a fallback approach
      if (status === 'authorized') {
        logStep("Attempting fallback for authorization flow");
        
        // Wait a moment for database consistency
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { error: retryError } = await supabaseClient
          .from('transactions')
          .update({ status })
          .eq('payment_intent_id', payment_intent_id);
          
        if (retryError) {
          logStep("Fallback also failed", { error: retryError.message });
          return new Response(
            JSON.stringify({ 
              error: 'Failed to update transaction status',
              details: retryError.message,
              success: false,
              requires_capture: status === 'authorized' // Indicate payment needs capture
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
      new_status: status,
      booking_id: transaction.booking_id
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction_id: transaction.id,
        old_status: transaction.status,
        new_status: status
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