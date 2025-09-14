import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Creating missing transaction records...');

    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Find bookings with payment data but no corresponding transactions
    const { data: bookingsWithPayments, error: bookingsError } = await supabaseServiceRole
      .from('bookings')
      .select(`
        id,
        payment_intent_id,
        payment_status,
        created_at,
        service:services(base_price)
      `)
      .not('payment_intent_id', 'is', null);

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    console.log(`Found ${bookingsWithPayments?.length || 0} bookings with payment data`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const booking of bookingsWithPayments || []) {
      try {
        // Check if transaction already exists
        const { data: existingTransaction, error: transactionError } = await supabaseServiceRole
          .from('transactions')
          .select('id')
          .eq('payment_intent_id', booking.payment_intent_id)
          .single();

        if (existingTransaction) {
          skippedCount++;
          continue; // Transaction already exists
        }

        // Determine transaction status and type based on payment_status
        let status = 'pending';
        let transactionType = 'charge';

        switch (booking.payment_status) {
          case 'completed':
            status = 'completed';
            transactionType = 'charge';
            break;
          case 'authorized':
            status = 'authorized';
            transactionType = 'authorization';
            break;
          case 'captured':
            status = 'completed';
            transactionType = 'capture';
            break;
          case 'failed':
            status = 'failed';
            transactionType = 'charge';
            break;
          default:
            status = 'pending';
            transactionType = 'charge';
        }

        // Create missing transaction
        const { error: createError } = await supabaseServiceRole
          .from('transactions')
          .insert({
            booking_id: booking.id,
            amount: booking.service?.base_price || 0,
            status: status,
            payment_intent_id: booking.payment_intent_id,
            payment_method: 'card',
            transaction_type: transactionType,
            currency: 'USD',
            created_at: booking.created_at, // Use booking creation time
          });

        if (createError) {
          console.error(`Failed to create transaction for booking ${booking.id}:`, createError);
          continue;
        }

        createdCount++;
        console.log(`Created transaction for booking ${booking.id}`);

      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error);
        continue;
      }
    }

    console.log(`Transaction creation complete: ${createdCount} created, ${skippedCount} skipped`);

    return new Response(JSON.stringify({
      success: true,
      created_count: createdCount,
      skipped_count: skippedCount,
      total_processed: (bookingsWithPayments?.length || 0),
      message: `Created ${createdCount} missing transaction records`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error creating missing transactions:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});