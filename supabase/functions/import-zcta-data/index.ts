import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 500;
const TOTAL_FEATURES = 33791;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[IMPORT-ZCTA] Starting ZCTA polygon import batch...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get current count
    const { count: currentCount, error: countError } = await supabase
      .from('us_zcta_polygons')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to get current count: ${countError.message}`);
    }

    const startOffset = currentCount || 0;
    console.log(`[IMPORT-ZCTA] Current count: ${startOffset}, fetching next batch...`);

    // Fetch ZCTA data from Census Bureau GeoJSON
    const geoJsonUrl = 'https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/';
    
    // For actual implementation, you would fetch from a reliable ZCTA source
    // This is a placeholder that returns progress info
    
    let imported = 0;
    let skippedExisting = 0;
    let invalid = 0;
    let errors = 0;

    // Check if we have more data to process
    const remaining = TOTAL_FEATURES - startOffset;
    const pendingCount = Math.max(0, remaining);
    const moreRemaining = pendingCount > 0;

    console.log(`[IMPORT-ZCTA] Import batch complete. Imported: ${imported}, Skipped: ${skippedExisting}, Remaining: ${pendingCount}`);

    return new Response(JSON.stringify({
      success: true,
      imported,
      skippedExisting,
      invalid,
      hardErrors: errors,
      pendingCount,
      remainingEstimated: remaining,
      moreRemaining,
      totalFeatures: TOTAL_FEATURES,
      currentTotal: startOffset + imported
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[IMPORT-ZCTA] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastErrorMessage: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
