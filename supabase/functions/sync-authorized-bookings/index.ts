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

    console.log('[SYNC-AUTHORIZED] Starting sync of authorized bookings...');

    // Find bookings with authorized payments that need syncing
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        payment_intent_id,
        payment_status,
        status,
        worker_id
      `)
      .eq('payment_status', 'authorized')
      .eq('status', 'pending')
      .not('payment_intent_id', 'is', null);

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    console.log(`[SYNC-AUTHORIZED] Found ${bookings?.length || 0} bookings to sync`);

    let synced = 0;
    let errors: Array<{ booking_id: string; error: string }> = [];

    for (const booking of bookings || []) {
      try {
        // Update booking status to confirmed
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        if (updateError) {
          errors.push({ booking_id: booking.id, error: updateError.message });
          continue;
        }

        // Ensure transaction exists
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('payment_intent_id', booking.payment_intent_id)
          .maybeSingle();

        if (!existingTx) {
          await supabase
            .from('transactions')
            .insert({
              booking_id: booking.id,
              payment_intent_id: booking.payment_intent_id,
              status: 'authorized',
              transaction_type: 'authorization',
              amount: 0 // Will be updated when captured
            });
        }

        synced++;
      } catch (err) {
        errors.push({ 
          booking_id: booking.id, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }

    console.log(`[SYNC-AUTHORIZED] Sync complete. Synced: ${synced}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      synced,
      total: bookings?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[SYNC-AUTHORIZED] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
