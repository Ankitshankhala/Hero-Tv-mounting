import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // DISABLED: This function was creating test bookings automatically
  return new Response(
    JSON.stringify({ 
      success: false, 
      message: 'E2E test booking creation has been disabled to prevent automatic test customer creation',
      disabled_at: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );

  // ALL BOOKING CREATION CODE REMOVED TO PREVENT AUTOMATIC E2E TEST CUSTOMERS
  // This function is now completely disabled and will only return the disabled message above
});
