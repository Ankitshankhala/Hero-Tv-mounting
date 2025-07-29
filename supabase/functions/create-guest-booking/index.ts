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
    
    console.log('Creating guest booking with data:', JSON.stringify(bookingData, null, 2));

    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate required fields for guest booking
    if (!bookingData.guest_customer_info?.email || 
        !bookingData.guest_customer_info?.name || 
        !bookingData.guest_customer_info?.phone) {
      throw new Error('Missing required guest customer information');
    }

    // Insert booking with service role permissions (bypasses RLS)
    const { data: newBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: null, // Guest user
        service_id: bookingData.service_id,
        scheduled_date: bookingData.scheduled_date,
        scheduled_start: bookingData.scheduled_start,
        location_notes: bookingData.location_notes,
        status: 'payment_pending',
        payment_status: 'pending',
        requires_manual_payment: false,
        guest_customer_info: bookingData.guest_customer_info
      })
      .select('id')
      .single();

    if (bookingError) {
      console.error('Booking creation error:', bookingError);
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    console.log('✅ Guest booking created successfully:', newBooking.id);

    // Also create booking services if provided
    if (bookingData.services && bookingData.services.length > 0) {
      const bookingServices = bookingData.services.map((service: any) => ({
        booking_id: newBooking.id,
        service_id: service.id,
        service_name: service.name,
        quantity: service.quantity || 1,
        base_price: service.base_price || 0,
        configuration: service.configuration || {}
      }));

      const { error: servicesError } = await supabase
        .from('booking_services')
        .insert(bookingServices);

      if (servicesError) {
        console.error('Error creating booking services:', servicesError);
        // Don't fail the whole operation, just log it
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking_id: newBooking.id,
        message: 'Guest booking created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-guest-booking:', error);
    
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
});