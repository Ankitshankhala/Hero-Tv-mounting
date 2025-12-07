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

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const operation = pathParts[pathParts.length - 1];

    console.log(`[WORKER-OPERATIONS] Operation: ${operation}`);

    switch (operation) {
      case 'eligible-workers': {
        const bookingId = url.searchParams.get('bookingId');
        
        if (!bookingId) {
          throw new Error('bookingId is required');
        }

        // Get booking details to find location
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            customer:users!bookings_customer_id_fkey(zip_code, city),
            guest_customer_info
          `)
          .eq('id', bookingId)
          .single();

        if (bookingError || !booking) {
          throw new Error(`Booking not found: ${bookingError?.message}`);
        }

        // Get customer ZIP code
        const customerZip = booking.customer?.zip_code || 
                           booking.guest_customer_info?.zipcode;

        if (!customerZip) {
          throw new Error('Customer ZIP code not found');
        }

        // Find workers covering this ZIP
        const { data: coveringWorkers, error: coverageError } = await supabase
          .from('worker_service_zipcodes')
          .select(`
            worker_id,
            worker:users!worker_service_zipcodes_worker_id_fkey(
              id, name, email, is_active
            )
          `)
          .eq('zipcode', customerZip);

        if (coverageError) {
          throw new Error(`Coverage query failed: ${coverageError.message}`);
        }

        // Filter to active workers, excluding current assigned worker
        const eligibleWorkers = (coveringWorkers || [])
          .filter(w => w.worker?.is_active && w.worker_id !== booking.worker_id)
          .map(w => ({
            id: w.worker_id,
            name: w.worker?.name || 'Unknown',
            email: w.worker?.email || ''
          }));

        console.log(`[WORKER-OPERATIONS] Found ${eligibleWorkers.length} eligible workers for ZIP: ${customerZip}`);

        return new Response(JSON.stringify({
          success: true,
          workers: eligibleWorkers,
          customerZip
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      case 'availability': {
        const workerId = url.searchParams.get('workerId');
        const date = url.searchParams.get('date');
        
        if (!workerId) {
          throw new Error('workerId is required');
        }

        // Get worker's availability schedule
        const { data: availability, error: availError } = await supabase
          .from('worker_availability')
          .select('*')
          .eq('worker_id', workerId);

        if (availError) {
          throw new Error(`Availability query failed: ${availError.message}`);
        }

        // Get worker's existing bookings for the date
        let existingBookings: any[] = [];
        if (date) {
          const { data: bookings } = await supabase
            .from('bookings')
            .select('id, scheduled_start, scheduled_date')
            .eq('worker_id', workerId)
            .eq('scheduled_date', date)
            .in('status', ['confirmed', 'pending']);

          existingBookings = bookings || [];
        }

        return new Response(JSON.stringify({
          success: true,
          availability,
          existingBookings
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      default: {
        // Handle POST requests with body
        if (req.method === 'POST') {
          const body = await req.json();
          
          return new Response(JSON.stringify({
            success: false,
            error: `Unknown POST operation. Received body: ${JSON.stringify(body)}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        throw new Error(`Unknown operation: ${operation}`);
      }
    }

  } catch (error) {
    console.error('[WORKER-OPERATIONS] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
