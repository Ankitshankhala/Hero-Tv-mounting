import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ASSIGN-AUTH-BOOKING-WORKER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function start');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Find the most recent booking needing assignment
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        `id, worker_id, status, scheduled_date, scheduled_start, customer_id, guest_customer_info, created_at, customer:users!bookings_customer_id_fkey(email, zip_code)`
      )
      .eq('status', 'payment_authorized')
      .is('worker_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (bookingError) {
      throw new Error(`Failed to fetch booking: ${bookingError.message}`);
    }

    if (!booking) {
      logStep('No booking found');
      return new Response(
        JSON.stringify({ success: false, message: 'No eligible booking found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Booking found', { booking_id: booking.id });

    const zipCode = booking.customer_id
      ? booking.customer?.zip_code
      : booking.guest_customer_info?.zipcode || booking.guest_customer_info?.zip_code;

    if (!zipCode) {
      logStep('Zip code missing for booking', { booking_id: booking.id });
      return new Response(
        JSON.stringify({ success: false, message: 'Booking missing zip code' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find available workers for that zip code and time
    const { data: candidates, error: workerError } = await supabase.rpc('find_available_workers', {
      p_zipcode: zipCode,
      p_scheduled_date: booking.scheduled_date,
      p_scheduled_start: booking.scheduled_start,
      p_duration_minutes: 60,
    });

    if (workerError) {
      throw new Error(`Failed to find available workers: ${workerError.message}`);
    }

    if (!candidates || candidates.length === 0) {
      logStep('No workers available', { booking_id: booking.id });
      return new Response(
        JSON.stringify({ success: false, message: 'No workers available' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let chosenWorker = candidates[0];
    let minBookings = Infinity;

    for (const worker of candidates) {
      const { count, error: countError } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('worker_id', worker.worker_id)
        .not('status', 'in', ['cancelled', 'completed']);

      if (countError) {
        logStep('Count query failed', { worker_id: worker.worker_id, error: countError.message });
        continue;
      }

      if (typeof count === 'number' && count < minBookings) {
        minBookings = count;
        chosenWorker = worker;
      }
    }

    if (!chosenWorker) {
      logStep('No worker selected after count check');
      return new Response(
        JSON.stringify({ success: false, message: 'No worker assigned' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Assigning worker', { booking_id: booking.id, worker_id: chosenWorker.worker_id });

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ worker_id: chosenWorker.worker_id })
      .eq('id', booking.id);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // Send worker assignment email
    try {
      const { error: emailError } = await supabase.functions.invoke(
        'send-worker-assignment-email',
        {
          body: { booking_id: booking.id, worker_id: chosenWorker.worker_id },
        }
      );
      if (emailError) {
        logStep('Worker assignment email failed', { error: emailError.message });
      }
    } catch (emailErr) {
      logStep('Error invoking worker email function', { error: emailErr });
    }

    // Send customer confirmation email
    const customerEmail = booking.customer_id
      ? booking.customer?.email
      : booking.guest_customer_info?.email;
    if (customerEmail) {
      try {
        const { error: custEmailErr } = await supabase.functions.invoke(
          'send-customer-booking-confirmation-email',
          {
            body: { booking_id: booking.id, customer_email: customerEmail },
          }
        );
        if (custEmailErr) {
          logStep('Customer confirmation email failed', {
            error: custEmailErr.message,
          });
        }
      } catch (custErr) {
        logStep('Error invoking customer email function', { error: custErr });
      }
    } else {
      logStep('Customer email missing, skipping confirmation email', {
        booking_id: booking.id,
      });
    }

    return new Response(
      JSON.stringify({ success: true, booking_id: booking.id, worker_id: chosenWorker.worker_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { error: errorMessage });
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
