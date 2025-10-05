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
    console.log('[ZCTA Import] Starting ZCTA data import from zcta2020_web.geojson');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Read the GeoJSON file from the public directory
    const geojsonUrl = `${Deno.env.get('SUPABASE_URL')?.replace('https://', 'https://')}/zcta2020_web.geojson`;
    console.log('[ZCTA Import] Fetching GeoJSON from:', geojsonUrl);
    
    // Try to fetch from public directory first, fallback to storage bucket
    let geoJsonResponse;
    try {
      geoJsonResponse = await fetch(`${new URL(req.url).origin}/zcta2020_web.geojson`);
    } catch (e) {
      console.log('[ZCTA Import] Failed to fetch from public, trying storage bucket');
      geoJsonResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/zcta2020_web.geojson`);
    }

    if (!geoJsonResponse.ok) {
      throw new Error(`Failed to fetch GeoJSON: ${geoJsonResponse.statusText}`);
    }

    const geoJson = await geoJsonResponse.json();
    const totalFeatures = geoJson.features?.length || 0;
    console.log(`[ZCTA Import] Loaded GeoJSON with ${totalFeatures} ZCTA features`);
    
    if (!totalFeatures) {
      throw new Error('No features found in GeoJSON file');
    }

    let imported = 0;
    let errors = 0;
    const BATCH_SIZE = 50; // Smaller batches for large geometry data
    const batches: any[] = [];

    // Prepare batches
    for (const feature of geoJson.features) {
      const zcta = feature.properties?.ZCTA5CE20 || feature.properties?.ZCTA5CE10;
      
      if (!zcta || !feature.geometry) {
        console.warn('[ZCTA Import] Skipping invalid feature:', feature.properties);
        errors++;
        continue;
      }

      batches.push({
        zcta5ce: zcta,
        geom: JSON.stringify(feature.geometry),
        land_area: feature.properties?.ALAND20 || feature.properties?.ALAND10 || null,
        water_area: feature.properties?.AWATER20 || feature.properties?.AWATER10 || null
      });

      // Process batch when it reaches BATCH_SIZE
      if (batches.length >= BATCH_SIZE) {
        try {
          const { data, error } = await supabase.rpc('insert_zcta_batch', { 
            batch_data: batches 
          });
          
          if (error) {
            console.error('[ZCTA Import] Batch insert error:', error);
            errors += batches.length;
          } else {
            imported += batches.length;
            console.log(`[ZCTA Import] Progress: ${imported}/${totalFeatures} (${Math.round(imported/totalFeatures*100)}%)`);
          }
        } catch (batchError) {
          console.error('[ZCTA Import] Batch processing error:', batchError);
          errors += batches.length;
        }
        
        batches.length = 0; // Clear batch
      }
    }

    // Import remaining records
    if (batches.length > 0) {
      try {
        const { error } = await supabase.rpc('insert_zcta_batch', { 
          batch_data: batches 
        });
        
        if (error) {
          console.error('[ZCTA Import] Final batch error:', error);
          errors += batches.length;
        } else {
          imported += batches.length;
        }
      } catch (finalError) {
        console.error('[ZCTA Import] Final batch processing error:', finalError);
        errors += batches.length;
      }
    }

    // Verify import count
    const { count } = await supabase
      .from('us_zcta_polygons')
      .select('*', { count: 'exact', head: true });

    console.log(`[ZCTA Import] Import complete. Processed: ${imported + errors}, Imported: ${imported}, Errors: ${errors}, DB Count: ${count}`);

    return new Response(JSON.stringify({ 
      success: true, 
      imported,
      errors,
      totalProcessed: imported + errors,
      databaseCount: count,
      message: `Successfully imported ${imported} of ${totalFeatures} ZCTA polygons (${errors} errors)`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ZCTA Import] Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
