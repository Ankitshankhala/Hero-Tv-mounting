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

    // Get booking ID from request body or find the most recent booking
    const body = await req.json().catch(() => ({}));
    const targetBookingId = body.booking_id;

    let booking;
    let bookingError;

    if (targetBookingId) {
      // Process specific booking
      const result = await supabase
        .from('bookings')
        .select(
          `id, worker_id, status, scheduled_date, scheduled_start, customer_id, guest_customer_info, created_at, preferred_worker_id, customer:users!bookings_customer_id_fkey(email, zip_code)`
        )
        .eq('id', targetBookingId)
        .single();
      
      booking = result.data;
      bookingError = result.error;

      if (booking && booking.worker_id) {
        logStep('Booking already has worker assigned', { booking_id: booking.id, worker_id: booking.worker_id });
        return new Response(
          JSON.stringify({ success: false, message: 'Booking already has a worker assigned' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Find the most recent booking needing assignment
      const result = await supabase
        .from('bookings')
        .select(
          `id, worker_id, status, scheduled_date, scheduled_start, customer_id, guest_customer_info, created_at, preferred_worker_id, customer:users!bookings_customer_id_fkey(email, zip_code)`
        )
        .eq('status', 'confirmed')
        .is('worker_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      booking = result.data;
      bookingError = result.error;
    }

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
      ? (booking.customer as any)?.zip_code
      : (booking.guest_customer_info?.zipcode || booking.guest_customer_info?.zip_code);

    if (!zipCode) {
      logStep('Zip code missing for booking', { 
        booking_id: booking.id,
        customer_id: booking.customer_id,
        guest_info: booking.guest_customer_info
      });
      return new Response(
        JSON.stringify({ success: false, message: 'Booking missing zip code - cannot assign worker' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's a preferred worker for this booking
    let preferredWorkerId = booking.preferred_worker_id;
    if (!preferredWorkerId) {
      // For guest bookings, check if preferred worker is in guest_customer_info
      const guestInfo = booking.guest_customer_info as any;
      preferredWorkerId = guestInfo?.preferred_worker_id;
    }

    // Use strict ZIP-based assignment only - no fallback assignments
    const { data: candidates, error: workerError } = await supabase.rpc('find_available_workers_by_zip', {
      p_customer_zipcode: zipCode,
      p_date: booking.scheduled_date,
      p_time: booking.scheduled_start,
      p_duration_minutes: 60,
    });

    if (workerError) {
      throw new Error(`Failed to find available workers: ${workerError.message}`);
    }

    if (!candidates || candidates.length === 0) {
      logStep('No workers with ZIP coverage available', { 
        booking_id: booking.id,
        zipcode: zipCode,
        scheduled_date: booking.scheduled_date,
        scheduled_start: booking.scheduled_start,
        message: 'Strict ZIP enforcement - no fallback assignment'
      });

      // Only downgrade to pending if booking doesn't have authorized payment
      // Check current payment/booking status first
      const currentStatus = booking.status;
      const shouldDowngrade = !['payment_authorized', 'confirmed'].includes(currentStatus);
      
      if (shouldDowngrade) {
        const { error: statusUpdateError } = await supabase
          .from('bookings')
          .update({ status: 'pending' })
          .eq('id', booking.id);

        if (statusUpdateError) {
          logStep('Failed to update booking status', { error: statusUpdateError.message });
        }
      } else {
        logStep('Preserving authorized booking status - no worker assignment required manual intervention', {
          current_status: currentStatus,
          booking_id: booking.id
        });
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `No workers available in ZIP code ${zipCode}. Booking requires manual assignment.`,
          booking_id: booking.id,
          status: 'pending'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Found workers with ZIP coverage', { 
      count: candidates.length,
      zipcode: zipCode,
      preferredWorkerId
    });

    let chosenWorker = candidates[0];
    let minBookings = Infinity;

    // First, check if preferred worker is available and in ZIP coverage
    if (preferredWorkerId) {
      const preferredWorker = candidates.find((worker: any) => worker.worker_id === preferredWorkerId);
      if (preferredWorker) {
        logStep('Preferred worker found and available', { 
          preferred_worker_id: preferredWorkerId,
          worker_name: preferredWorker.worker_name 
        });
        chosenWorker = preferredWorker;
        
        // Skip the load balancing logic and assign directly to preferred worker
        logStep('Assigning to preferred worker', { booking_id: booking.id, worker_id: chosenWorker.worker_id });

        const { error: updateError } = await supabase
          .from('bookings')
          .update({ worker_id: chosenWorker.worker_id })
          .eq('id', booking.id);

        if (updateError) {
          throw new Error(`Failed to update booking: ${updateError.message}`);
        }

        // Send notifications and return success
        await sendNotifications(booking, chosenWorker);
        return new Response(
          JSON.stringify({ success: true, booking_id: booking.id, worker_id: chosenWorker.worker_id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        logStep('Preferred worker not available or not in ZIP coverage', { 
          preferred_worker_id: preferredWorkerId,
          available_workers: candidates.map((w: any) => w.worker_id)
        });
      }
    }

    // Fall back to load balancing if no preferred worker or preferred worker not available
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

    logStep('Assigning worker via load balancing', { booking_id: booking.id, worker_id: chosenWorker.worker_id });

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ worker_id: chosenWorker.worker_id })
      .eq('id', booking.id);

    if (updateError) {
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    // Send notifications
    await sendNotifications(booking, chosenWorker);

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

// Helper function to send notifications
async function sendNotifications(booking: any, chosenWorker: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );
  try {
    // Send worker assignment email and SMS
    try {
      // Send email notification with force to ensure delivery
      const { error: emailError } = await supabase.functions.invoke(
        'send-worker-assignment-notification',
        {
          body: { bookingId: booking.id, workerId: chosenWorker.worker_id, force: true },
        }
      );
      if (emailError) {
        logStep('Worker assignment email failed', { error: emailError.message });
      } else {
        logStep('Worker assignment email sent successfully');
      }

      // Send SMS notification
      const { error: smsError } = await supabase.functions.invoke(
        'send-sms-notification',
        {
          body: { bookingId: booking.id },
        }
      );
      if (smsError) {
        logStep('Worker assignment SMS failed', { error: smsError.message });
      } else {
        logStep('Worker assignment SMS sent successfully');
      }
    } catch (notificationErr) {
      logStep('Error invoking worker notification functions', { error: notificationErr });
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
  } catch (error) {
    logStep('Error in sendNotifications', { error });
  }
}
