import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolygonPoint {
  lat: number;
  lng: number;
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

    // Find all service areas that have polygons but no ZIP codes
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

        // Check if this area already has ZIP codes
        const { data: existingZips, error: zipCheckError } = await supabase
          .from('worker_service_zipcodes')
          .select('zipcode')
          .eq('service_area_id', area.id)
          .limit(1);

        if (zipCheckError) {
          console.error(`Error checking existing ZIP codes for area ${area.id}:`, zipCheckError);
          errors++;
          continue;
        }

        if (existingZips && existingZips.length > 0) {
          console.log(`Area ${area.id} already has ZIP codes, skipping`);
          continue;
        }

        // Parse polygon coordinates
        let polygon: PolygonPoint[];
        try {
          polygon = JSON.parse(area.polygon_coordinates);
          if (!Array.isArray(polygon) || polygon.length < 3) {
            throw new Error('Invalid polygon data');
          }
        } catch (e) {
          console.error(`Invalid polygon coordinates for area ${area.id}:`, e);
          errors++;
          continue;
        }

        // Use the polygon-to-zipcodes function to find ZIP codes
        console.log(`Calling polygon-to-zipcodes for area ${area.id} with ${polygon.length} points`);
        
        const { data: zipResult, error: zipError } = await supabase.functions.invoke('polygon-to-zipcodes', {
          body: {
            polygon: polygon,
            workerId: area.worker_id,
            areaName: area.area_name
          }
        });

        if (zipError) {
          console.error(`Error calling polygon-to-zipcodes for area ${area.id}:`, zipError);
          errors++;
          continue;
        }

        const zipcodes = zipResult?.zipcodes || [];
        console.log(`Found ${zipcodes.length} ZIP codes for area ${area.id}:`, zipcodes.slice(0, 5));

        if (zipcodes.length === 0) {
          console.log(`No ZIP codes found for area ${area.id}, trying fallback...`);
          
          // Try the PostGIS function directly as fallback
          const { data: fallbackZips, error: fallbackError } = await supabase.rpc('find_zipcodes_intersecting_polygon', {
            polygon_coords: polygon
          });

          if (!fallbackError && fallbackZips && fallbackZips.length > 0) {
            console.log(`Fallback found ${fallbackZips.length} ZIP codes for area ${area.id}`);
            zipcodes.push(...fallbackZips);
          }
        }

        if (zipcodes.length > 0) {
          // Insert ZIP codes into worker_service_zipcodes table
          const zipInserts = zipcodes.map((zipcode: string) => ({
            worker_id: area.worker_id,
            service_area_id: area.id,
            zipcode: zipcode
          }));

          const { error: insertError } = await supabase
            .from('worker_service_zipcodes')
            .insert(zipInserts);

          if (insertError) {
            console.error(`Error inserting ZIP codes for area ${area.id}:`, insertError);
            errors++;
            continue;
          }

          console.log(`Successfully added ${zipcodes.length} ZIP codes to area ${area.id}`);
          processed++;

          results.push({
            area_id: area.id,
            area_name: area.area_name,
            worker_id: area.worker_id,
            zipcodes_added: zipcodes.length,
            zipcodes: zipcodes
          });

          // Log to service area audit log
          await supabase
            .from('service_area_audit_logs')
            .insert({
              worker_id: area.worker_id,
              record_id: area.id,
              table_name: 'worker_service_areas',
              operation: 'backfill',
              area_name: area.area_name,
              change_summary: `Backfilled ${zipcodes.length} ZIP codes`,
              new_data: { zipcodes_added: zipcodes.length, zipcodes: zipcodes }
            });

        } else {
          console.log(`No ZIP codes could be found for area ${area.id} even with fallback`);
          results.push({
            area_id: area.id,
            area_name: area.area_name,
            worker_id: area.worker_id,
            zipcodes_added: 0,
            error: 'No ZIP codes found in polygon'
          });
        }

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