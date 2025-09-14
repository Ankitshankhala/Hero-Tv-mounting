import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BACKFILL-AUTHORIZED] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting authorized bookings backfill');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Find bookings with authorized transactions but incorrect status
    const { data: bookingsWithAuthorizedPayments, error: queryError } = await supabase
      .from('bookings')
      .select(`
        id, status, payment_status, payment_intent_id,
        transactions!inner(id, status, payment_intent_id)
      `)
      .eq('transactions.status', 'authorized')
      .not('status', 'in', '(confirmed,payment_authorized,completed)');

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    logStep('Found bookings with authorized payments needing status update', { 
      count: bookingsWithAuthorizedPayments?.length || 0 
    });

    let updatedCount = 0;
    const results = [];

    if (bookingsWithAuthorizedPayments && bookingsWithAuthorizedPayments.length > 0) {
      for (const booking of bookingsWithAuthorizedPayments) {
        try {
          logStep('Updating booking status to confirmed', { 
            booking_id: booking.id,
            old_status: booking.status,
            old_payment_status: booking.payment_status
          });

          const { error: updateError } = await supabase
            .from('bookings')
            .update({ 
              status: 'confirmed',
              payment_status: 'authorized'
            })
            .eq('id', booking.id);

          if (updateError) {
            logStep('Failed to update booking', { 
              booking_id: booking.id, 
              error: updateError.message 
            });
            results.push({
              booking_id: booking.id,
              success: false,
              error: updateError.message
            });
          } else {
            updatedCount++;
            results.push({
              booking_id: booking.id,
              success: true,
              old_status: booking.status,
              new_status: 'confirmed'
            });
            logStep('Successfully updated booking', { booking_id: booking.id });
          }
        } catch (error) {
          logStep('Error processing booking', { 
            booking_id: booking.id, 
            error: error instanceof Error ? error.message : String(error) 
          });
          results.push({
            booking_id: booking.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    // Also check for any bookings that have authorized payment intent but no transaction record
    const { data: orphanedBookings, error: orphanError } = await supabase
      .from('bookings')
      .select('id, status, payment_status, payment_intent_id')
      .not('payment_intent_id', 'is', null)
      .not('status', 'in', '(confirmed,payment_authorized,completed)')
      .not('id', 'in', `(${bookingsWithAuthorizedPayments?.map(b => `'${b.id}'`).join(',') || "''"})`)
      .limit(20);

    if (!orphanError && orphanedBookings && orphanedBookings.length > 0) {
      logStep('Found bookings with payment_intent but no transaction record', { 
        count: orphanedBookings.length 
      });
      
      for (const booking of orphanedBookings) {
        // Try to call the consistency checker for each booking
        try {
          const consistencyResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/booking-status-consistency-check`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              booking_id: booking.id,
              payment_intent_id: booking.payment_intent_id
            })
          });

          if (consistencyResponse.ok) {
            const consistencyResult = await consistencyResponse.json();
            results.push({
              booking_id: booking.id,
              success: true,
              consistency_check: true,
              fixes_applied: consistencyResult.fixes_applied
            });
            logStep('Consistency check applied', { 
              booking_id: booking.id, 
              fixes: consistencyResult.fixes_applied 
            });
          }
        } catch (error) {
          logStep('Consistency check failed', { 
            booking_id: booking.id, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    }

    const summary = {
      success: true,
      updated_bookings: updatedCount,
      total_checked: (bookingsWithAuthorizedPayments?.length || 0) + (orphanedBookings?.length || 0),
      results,
      message: `Backfill completed: ${updatedCount} bookings updated to confirmed status`
    };

    logStep('Backfill completed', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { error: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});