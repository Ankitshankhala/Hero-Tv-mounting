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

    // Fetch all existing ZCTA codes to skip duplicates
    console.log('[ZCTA Import] Fetching existing ZCTA codes from database...');
    const existingZctas = new Set<string>();
    const PAGE_SIZE = 10000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('us_zcta_polygons')
        .select('zcta5ce')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error('[ZCTA Import] Error fetching existing ZCTAs:', error);
        throw error;
      }

      if (data && data.length > 0) {
        data.forEach(row => existingZctas.add(row.zcta5ce));
        console.log(`[ZCTA Import] Loaded ${existingZctas.size} existing ZCTAs (page ${page + 1})`);
      }

      hasMore = data && data.length === PAGE_SIZE;
      page++;
    }

    console.log(`[ZCTA Import] Total existing ZCTAs in database: ${existingZctas.size}`);

    // Read the GeoJSON file from Supabase Storage
    const storageUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/zcta-data/zcta2020_web.geojson`;
    console.log('[ZCTA Import] Fetching GeoJSON from Supabase Storage:', storageUrl);
    
    const geoJsonResponse = await fetch(storageUrl);

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
    let skippedExisting = 0;
    let errors = 0;
    const BATCH_SIZE = 50;
    const batches: any[] = [];

    // Prepare batches
    for (const feature of geoJson.features) {
      // Check multiple possible ZCTA property names
      let zcta = feature.properties?.ZCTA5CE20 
               || feature.properties?.ZCTA5CE10 
               || feature.properties?.ZCTA5CE
               || feature.properties?.GEOID20
               || feature.properties?.GEOID10
               || feature.properties?.GEOID;
      
      if (!zcta || !feature.geometry) {
        console.warn('[ZCTA Import] Skipping invalid feature:', feature.properties);
        errors++;
        continue;
      }

      // Normalize ZCTA to 5-digit string
      zcta = String(zcta).trim().padStart(5, '0').substring(0, 5);

      // Skip if already exists in database
      if (existingZctas.has(zcta)) {
        skippedExisting++;
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
            console.log(`[ZCTA Import] Progress: Imported ${imported}, Skipped ${skippedExisting}, Errors ${errors} (Total processed: ${imported + skippedExisting + errors}/${totalFeatures})`);
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

    const remainingEstimated = totalFeatures - (count || 0);

    console.log(`[ZCTA Import] Import complete. Skipped existing: ${skippedExisting}, Imported: ${imported}, Errors: ${errors}, DB Count: ${count}, Remaining: ${remainingEstimated}`);

    return new Response(JSON.stringify({ 
      success: true, 
      imported,
      skippedExisting,
      errors,
      totalProcessed: imported + skippedExisting + errors,
      databaseCount: count,
      remainingEstimated,
      message: `Successfully imported ${imported} new ZCTAs (${skippedExisting} already existed, ${errors} errors)`
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
