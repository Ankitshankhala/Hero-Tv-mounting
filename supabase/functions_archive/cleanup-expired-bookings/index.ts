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
    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting cleanup of expired pending bookings...');

    // Call the cleanup function with 30 minute grace period
    const { data: cleanedBookings, error: cleanupError } = await supabase
      .rpc('cleanup_expired_pending_bookings', {
        p_grace_period_minutes: 30
      });

    if (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
      throw new Error(`Cleanup failed: ${cleanupError.message}`);
    }

    const cleanupCount = cleanedBookings ? cleanedBookings.length : 0;
    console.log(`Successfully cleaned up ${cleanupCount} expired bookings`);

    // Log cleanup results
    if (cleanedBookings && cleanedBookings.length > 0) {
      const bookingIds = cleanedBookings.map((booking: any) => booking.cleaned_booking_id);
      console.log('Cleaned booking IDs:', bookingIds);
      
      // TODO: Add cleanup of orphaned Stripe payment intents here
      // This would require the Stripe secret key and calling Stripe API
      // For now, we'll log the payment intents that need cleanup
      const paymentIntents = cleanedBookings
        .filter((booking: any) => booking.payment_intent_id)
        .map((booking: any) => booking.payment_intent_id);
      
      if (paymentIntents.length > 0) {
        console.log('Payment intents that may need Stripe cleanup:', paymentIntents);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cleaned_count: cleanupCount,
        message: `Successfully cleaned up ${cleanupCount} expired pending bookings`,
        cleaned_bookings: cleanedBookings || []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
})