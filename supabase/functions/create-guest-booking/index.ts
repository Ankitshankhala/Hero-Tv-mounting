import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { bookingData } = await req.json();

    if (!bookingData) {
      throw new Error('Booking data is required');
    }

    console.log('Creating guest booking with data:', JSON.stringify(bookingData, null, 2));

    // Extract services array (if provided) before inserting booking
    const services = bookingData.services || [];
    delete bookingData.services; // Remove from booking data before insert

    // Validate required fields
    if (!bookingData.service_id) {
      throw new Error('service_id is required');
    }
    if (!bookingData.scheduled_date) {
      throw new Error('scheduled_date is required');
    }
    if (!bookingData.scheduled_start) {
      throw new Error('scheduled_start is required');
    }
    if (!bookingData.guest_customer_info?.email) {
      throw new Error('guest_customer_info.email is required');
    }

    // PHASE 1: CRITICAL - Verify worker availability before creating booking
    console.log('🔍 Checking worker availability before creating booking...');

    const { data: availableWorkers, error: availError } = await supabaseClient.rpc(
      'find_available_workers_by_zip',
      {
        p_zipcode: bookingData.guest_customer_info.zipcode,
        p_date: bookingData.scheduled_date,
        p_time: bookingData.scheduled_start,
        p_duration_minutes: 60
      }
    );

    if (availError) {
      console.error('Worker availability check failed:', availError);
      throw new Error('Unable to verify worker availability. Please try again.');
    }

    if (!availableWorkers || availableWorkers.length === 0) {
      const errorMsg = `No workers available in ZIP ${bookingData.guest_customer_info.zipcode} ` +
        `on ${bookingData.scheduled_date} at ${bookingData.scheduled_start}. Please select a different date or time.`;
      console.warn('⚠️ ' + errorMsg);
      throw new Error(errorMsg);
    }

    console.log('✅ Workers available:', availableWorkers.length);

    // Verify preferred worker if specified
    if (bookingData.preferred_worker_id) {
      const preferredAvailable = availableWorkers.some(
        (w: any) => w.worker_id === bookingData.preferred_worker_id
      );
      
      if (!preferredAvailable) {
        console.warn('⚠️ Preferred worker not available, clearing preference');
        bookingData.preferred_worker_id = null;
      }
    }

    // PHASE 2: Reserve the best available worker
    const reservedWorker = availableWorkers[0];
    const reservationExpiry = new Date(Date.now() + 15 * 60 * 1000);
    console.log('🎯 Reserving worker:', reservedWorker.worker_id, 'until', reservationExpiry.toISOString());

    // Insert booking (using service role key to bypass RLS)
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert({
        customer_id: bookingData.customer_id || null,
        service_id: bookingData.service_id,
        scheduled_date: bookingData.scheduled_date,
        scheduled_start: bookingData.scheduled_start,
        location_notes: bookingData.location_notes || '',
        status: bookingData.status || 'payment_pending',
        payment_status: bookingData.payment_status || 'pending',
        requires_manual_payment: bookingData.requires_manual_payment || false,
        preferred_worker_id: bookingData.preferred_worker_id || null,
        reserved_worker_id: reservedWorker.worker_id, // NEW: Reserve worker
        reservation_expires_at: reservationExpiry.toISOString(), // NEW: 15-min expiry
        guest_customer_info: bookingData.guest_customer_info,
        tip_amount: bookingData.guest_customer_info?.tip_amount || 0,
      })
      .select('id')
      .single();

    if (bookingError) {
      console.error('Booking insert error:', bookingError);
      throw new Error(`Failed to insert booking: ${bookingError.message}`);
    }

    console.log('✅ Booking created successfully:', booking.id);

    // Insert booking services if provided
    if (services.length > 0) {
      const serviceInserts = services.map((service: any) => ({
        booking_id: booking.id,
        service_id: service.id,
        service_name: service.name || 'Unknown Service',
        base_price: service.price || 0,
        quantity: service.quantity || 1,
        configuration: service.options || {},
      }));

      const { error: servicesError } = await supabaseClient
        .from('booking_services')
        .insert(serviceInserts);

      if (servicesError) {
        console.error('❌ Booking services insert error:', servicesError);
        console.error('Failed service inserts:', JSON.stringify(serviceInserts, null, 2));
        throw new Error(`Failed to insert booking services: ${servicesError.message}`);
      } else {
        console.log('✅ Booking services inserted successfully:', serviceInserts.length, 'services');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: booking.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating guest booking:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to create guest booking',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
