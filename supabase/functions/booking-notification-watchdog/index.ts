import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Booking Notification Watchdog
 * 
 * This edge function is called by the automated cron job (run_automated_watchdog)
 * to ensure booking confirmation emails are sent correctly.
 * 
 * It routes to the proper email functions:
 * - send-customer-booking-confirmation-email (for customer confirmation with worker phone)
 * - send-worker-assignment-notification (for worker assignment)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const bookingId = body.bookingId || body.booking_id;

    if (!bookingId) {
      console.log('[WATCHDOG] No bookingId provided');
      return new Response(
        JSON.stringify({ success: false, error: 'bookingId required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[WATCHDOG] Processing booking: ${bookingId}`);

    // Fetch booking with worker details using explicit FK names
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        payment_status,
        worker_id,
        customer_id,
        guest_customer_info,
        confirmation_email_sent,
        worker_assignment_email_sent,
        worker:users!bookings_worker_id_fkey(id, name, email, phone)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.log(`[WATCHDOG] Booking not found: ${bookingId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Booking not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`[WATCHDOG] Booking status: ${booking.status}, payment: ${booking.payment_status}, worker_id: ${booking.worker_id}`);
    console.log(`[WATCHDOG] Email flags - confirmation: ${booking.confirmation_email_sent}, worker: ${booking.worker_assignment_email_sent}`);

    // Only process if payment is authorized/completed/captured
    const validPaymentStatuses = ['authorized', 'completed', 'captured', 'paid'];
    if (!validPaymentStatuses.includes(booking.payment_status)) {
      console.log(`[WATCHDOG] Skipping - payment status not valid: ${booking.payment_status}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Skipped - payment not authorized', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actions: string[] = [];

    // 1. Send customer confirmation email if not sent and worker is assigned
    if (!booking.confirmation_email_sent && booking.worker_id) {
      console.log(`[WATCHDOG] Sending customer confirmation email...`);
      
      // Prepare worker data to pass to email function
      const workerData = booking.worker ? {
        id: booking.worker.id,
        name: booking.worker.name,
        email: booking.worker.email,
        phone: booking.worker.phone
      } : null;

      console.log(`[WATCHDOG] Worker data for email:`, workerData ? 
        `${workerData.name}, phone: ${workerData.phone || 'N/A'}` : 'No worker data');

      try {
        const { error: emailError } = await supabase.functions.invoke(
          'send-customer-booking-confirmation-email',
          {
            body: { 
              bookingId, 
              workerData  // Pass pre-resolved worker data with phone
            }
          }
        );

        if (emailError) {
          console.error(`[WATCHDOG] Customer email error:`, emailError);
        } else {
          actions.push('customer_confirmation_email_sent');
          console.log(`[WATCHDOG] Customer confirmation email triggered successfully`);
        }
      } catch (err) {
        console.error(`[WATCHDOG] Failed to invoke customer email function:`, err);
      }
    } else if (!booking.confirmation_email_sent && !booking.worker_id) {
      console.log(`[WATCHDOG] Skipping customer email - no worker assigned yet`);
    }

    // 2. Send worker assignment email if not sent
    if (!booking.worker_assignment_email_sent && booking.worker_id) {
      console.log(`[WATCHDOG] Sending worker assignment email...`);
      
      try {
        const { error: workerEmailError } = await supabase.functions.invoke(
          'send-worker-assignment-notification',
          {
            body: { 
              bookingId,
              workerId: booking.worker_id
            }
          }
        );

        if (workerEmailError) {
          console.error(`[WATCHDOG] Worker email error:`, workerEmailError);
        } else {
          actions.push('worker_assignment_email_sent');
          console.log(`[WATCHDOG] Worker assignment email triggered successfully`);
        }
      } catch (err) {
        console.error(`[WATCHDOG] Failed to invoke worker email function:`, err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[WATCHDOG] Completed in ${duration}ms. Actions: ${actions.join(', ') || 'none'}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        bookingId,
        actions,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[WATCHDOG] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
