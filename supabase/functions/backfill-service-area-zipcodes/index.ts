import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting backfill process for service areas without ZIP codes...');

    // Find all service areas that have polygons but may need ZIP code refresh
    const { data: areasToBackfill, error: fetchError } = await supabase
      .from('worker_service_areas')
      .select(`
        id,
        worker_id,
        area_name,
        polygon_coordinates,
        is_active,
        created_at
      `)
      .not('polygon_coordinates', 'is', null)
      .eq('is_active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch service areas: ${fetchError.message}`);
    }

    if (!areasToBackfill || areasToBackfill.length === 0) {
      console.log('No service areas found that need ZIP code backfill');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No service areas need ZIP code backfill',
          processed: 0,
          errors: 0 
        }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Found ${areasToBackfill.length} service areas to process`);

    let processed = 0;
    let errors = 0;
    const results: any[] = [];

    for (const area of areasToBackfill) {
      try {
        console.log(`Processing area ${area.id}: ${area.area_name}`);

        // Use the new canonical function to compute ZIP codes
        const { data: zipCodes, error: zipError } = await supabase.rpc('compute_zipcodes_for_service_area', {
          service_area_id: area.id,
          min_overlap_percent: 0.02 // 2% minimum overlap
        });

        if (zipError) {
          console.error(`Error computing ZIP codes for area ${area.id}:`, zipError);
          errors++;
          results.push({
            area_id: area.id,
            area_name: area.area_name,
            error: zipError.message
          });
          continue;
        }

        const zipCount = zipCodes ? zipCodes.length : 0;
        console.log(`Successfully computed ${zipCount} ZIP codes for area ${area.id}`);
        processed++;

        results.push({
          area_id: area.id,
          area_name: area.area_name,
          worker_id: area.worker_id,
          zipcodes_computed: zipCount,
          zipcodes: zipCodes || []
        });

      } catch (error) {
        console.error(`Error processing area ${area.id}:`, error);
        errors++;
        results.push({
          area_id: area.id,
          area_name: area.area_name,
          error: error.message
        });
      }
    }

    console.log(`Backfill completed: ${processed} areas processed, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill completed: ${processed} areas processed, ${errors} errors`,
        processed,
        errors,
        total_areas: areasToBackfill.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processed: 0,
        errors: 1
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});