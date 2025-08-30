import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingData } = await req.json();

    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Enhanced validation for guest booking
    if (!bookingData.guest_customer_info?.email || 
        !bookingData.guest_customer_info?.name || 
        !bookingData.guest_customer_info?.phone ||
        !bookingData.service_id ||
        !bookingData.scheduled_date ||
        !bookingData.scheduled_start) {
      throw new Error('Missing required guest customer information or booking details');
    }

    console.log('Checking for existing pending booking for guest user:', {
      email: bookingData.guest_customer_info.email,
      phone: bookingData.guest_customer_info.phone,
      date: bookingData.scheduled_date,
      time: bookingData.scheduled_start
    });

    // Check for existing pending booking within grace period
    const { data: existingBooking, error: checkError } = await supabase
      .rpc('find_existing_pending_booking', {
        p_customer_id: null,
        p_guest_email: bookingData.guest_customer_info.email,
        p_guest_phone: bookingData.guest_customer_info.phone,
        p_scheduled_date: bookingData.scheduled_date,
        p_scheduled_start: bookingData.scheduled_start,
        p_grace_period_minutes: 30
      });

    if (checkError) {
      console.error('Error checking for existing booking:', checkError);
      // Continue with booking creation if check fails
    }

    // If existing booking found, return it instead of creating new one
    if (existingBooking && existingBooking.length > 0) {
      const existing = existingBooking[0];
      console.log('Found existing pending booking:', existing.booking_id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          booking_id: existing.booking_id,
          message: 'Resuming existing booking within grace period',
          resumed: true,
          created_at: existing.created_at
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('No existing booking found, creating new booking');

    // Insert booking with service role permissions (bypasses RLS)
    const { data: newBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: null, // Guest user
        service_id: bookingData.service_id,
        scheduled_date: bookingData.scheduled_date,
        scheduled_start: bookingData.scheduled_start,
        location_notes: bookingData.location_notes || '',
        status: 'payment_pending',
        payment_status: 'pending',
        requires_manual_payment: false,
        guest_customer_info: bookingData.guest_customer_info,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (bookingError) {
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    // Also create booking services if provided
    if (bookingData.services && bookingData.services.length > 0) {
      const bookingServices = bookingData.services.map((service: any) => ({
        booking_id: newBooking.id,
        service_id: service.id,
        service_name: service.name,
        quantity: service.quantity || 1,
        base_price: service.price || service.base_price || 0,
        configuration: service.options || service.configuration || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: servicesError } = await supabase
        .from('booking_services')
        .insert(bookingServices);

      if (servicesError) {
        console.error('Failed to create booking services:', servicesError);
        // Rollback booking creation
        await supabase.from('bookings').delete().eq('id', newBooking.id);
        throw new Error(`Failed to create booking services: ${servicesError.message}`);
      } else {
        console.log('Successfully created booking services for booking:', newBooking.id);
      }
    }

    console.log('Successfully created new booking:', newBooking.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking_id: newBooking.id,
        message: 'Guest booking created successfully',
        resumed: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Guest booking creation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
})