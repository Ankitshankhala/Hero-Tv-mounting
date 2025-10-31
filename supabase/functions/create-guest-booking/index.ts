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
        quantity: service.quantity || 1,
        unit_price: service.price,
        service_details: service.options || {},
      }));

      const { error: servicesError } = await supabaseClient
        .from('booking_services')
        .insert(serviceInserts);

      if (servicesError) {
        console.error('Booking services insert error:', servicesError);
        // Don't fail the entire booking if services insert fails
        // The booking is already created, just log the error
        console.warn('⚠️ Booking created but services insert failed:', servicesError.message);
      } else {
        console.log('✅ Booking services inserted successfully');
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
