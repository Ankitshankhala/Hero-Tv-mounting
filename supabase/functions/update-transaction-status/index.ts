import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { payment_intent_id, status, booking_id } = await req.json();

    if (!payment_intent_id) {
      throw new Error('payment_intent_id is required');
    }

    if (!status) {
      throw new Error('status is required');
    }

    console.log(`[UPDATE-TRANSACTION-STATUS] Updating status for PI: ${payment_intent_id} to: ${status}`);

    // Find the transaction
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('id, booking_id, status')
      .eq('payment_intent_id', payment_intent_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[UPDATE-TRANSACTION-STATUS] Fetch error:', fetchError);
    }

    if (transaction) {
      // Update existing transaction
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      if (updateError) {
        throw new Error(`Failed to update transaction: ${updateError.message}`);
      }

      console.log(`[UPDATE-TRANSACTION-STATUS] Transaction updated: ${transaction.id}`);

      // Also update booking payment status if needed
      if (transaction.booking_id && status === 'authorized') {
        await supabase
          .from('bookings')
          .update({ payment_status: 'authorized' })
          .eq('id', transaction.booking_id);
      }
    } else {
      // No existing transaction, create one if booking_id provided
      if (booking_id) {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert({
            booking_id,
            payment_intent_id,
            status,
            amount: 0, // Will be updated when capture happens
            transaction_type: status === 'authorized' ? 'authorization' : 'unknown'
          });

        if (insertError) {
          console.error('[UPDATE-TRANSACTION-STATUS] Insert error:', insertError);
        }

        // Update booking payment status
        await supabase
          .from('bookings')
          .update({ 
            payment_status: status,
            payment_intent_id 
          })
          .eq('id', booking_id);
      }

      console.log(`[UPDATE-TRANSACTION-STATUS] Created new transaction record`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Transaction status updated to ${status}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[UPDATE-TRANSACTION-STATUS] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
