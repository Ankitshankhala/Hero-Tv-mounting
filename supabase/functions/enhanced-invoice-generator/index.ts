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

    const { booking_id, send_email = true, trigger_source = 'manual' } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log(`[ENHANCED-INVOICE] Generating invoice for booking: ${booking_id}, trigger: ${trigger_source}`);

    // Delegate to the main generate-invoice function
    const { data, error } = await supabase.functions.invoke('generate-invoice', {
      body: { booking_id, send_email, force_regenerate: false }
    });

    if (error) {
      throw new Error(`Invoice generation failed: ${error.message}`);
    }

    console.log(`[ENHANCED-INVOICE] Invoice generated successfully:`, data);

    return new Response(JSON.stringify({
      success: true,
      ...data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[ENHANCED-INVOICE] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
