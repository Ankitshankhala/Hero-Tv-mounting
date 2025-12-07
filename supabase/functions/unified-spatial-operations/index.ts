import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

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
      { auth: { persistSession: false } }
    );

    const { operation, data, workerId } = await req.json();

    console.log(`[UNIFIED-SPATIAL] Operation: ${operation}, Worker: ${workerId}`);

    switch (operation) {
      case 'draw-area-save': {
        const { areaName, polygon, mode } = data;
        
        if (!workerId || !polygon || polygon.length < 3) {
          throw new Error('Invalid request: workerId and polygon with at least 3 points required');
        }

        // Delegate to service-area-upsert
        const { data: result, error } = await supabase.functions.invoke('service-area-upsert', {
          body: {
            workerId,
            polygon,
            areaName: areaName || 'Drawn Service Area',
            mode: mode || 'create'
          }
        });

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          areaId: result?.data?.area_id,
          zipcodesCount: result?.data?.zipcode_count || 0,
          zipcodes: result?.data?.zipcodes || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      case 'service-area-upsert': {
        const { areaName, zipcodesOnly, mode } = data;
        
        // Delegate to service-area-upsert
        const { data: result, error } = await supabase.functions.invoke('service-area-upsert', {
          body: {
            workerId: data.workerId || workerId,
            areaName: areaName || 'Manual Entry',
            zipCodes: zipcodesOnly,
            mode: mode || 'append'
          }
        });

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          zipcodesCount: result?.data?.zipcode_count || 0,
          zipcodes: result?.data?.zipcodes || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      case 'get-coverage': {
        const { zipcode } = data;
        
        const { data: coverage, error } = await supabase.rpc('get_zip_coverage_info', {
          p_zipcode: zipcode
        });

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          coverage
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

  } catch (error) {
    console.error('[UNIFIED-SPATIAL] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
