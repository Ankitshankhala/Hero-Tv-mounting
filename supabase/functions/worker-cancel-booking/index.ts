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

    const { bookingId, reason, workerId } = await req.json();

    if (!bookingId) {
      throw new Error('bookingId is required');
    }

    console.log(`[WORKER-CANCEL] Cancelling booking: ${bookingId}, Worker: ${workerId}`);

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(id, name, email),
        worker:users!bookings_worker_id_fkey(id, name, email)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message || 'Unknown error'}`);
    }

    // Check if worker is authorized to cancel
    if (workerId && booking.worker_id !== workerId) {
      throw new Error('Worker not authorized to cancel this booking');
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (updateError) {
      throw new Error(`Failed to cancel booking: ${updateError.message}`);
    }

    // Cancel any pending payment intents
    if (booking.payment_intent_id) {
      try {
        await supabase.functions.invoke('cancel-payment-intent', {
          body: {
            payment_intent_id: booking.payment_intent_id,
            reason: reason || 'Worker cancelled booking'
          }
        });
      } catch (cancelError) {
        console.error('[WORKER-CANCEL] Payment cancellation failed:', cancelError);
      }
    }

    // Log the cancellation
    await supabase
      .from('booking_audit_log')
      .insert({
        booking_id: bookingId,
        operation: 'worker_cancel',
        details: {
          reason,
          worker_id: workerId,
          cancelled_at: new Date().toISOString()
        }
      });

    // Notify customer
    if (booking.customer?.email) {
      try {
        await supabase.functions.invoke('unified-email-dispatcher', {
          body: {
            bookingId,
            recipientEmail: booking.customer.email,
            emailType: 'booking_cancelled'
          }
        });
      } catch (emailError) {
        console.error('[WORKER-CANCEL] Customer notification failed:', emailError);
      }
    }

    console.log(`[WORKER-CANCEL] Booking cancelled successfully: ${bookingId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Booking cancelled successfully',
      bookingId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[WORKER-CANCEL] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
