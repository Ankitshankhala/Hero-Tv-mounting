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

// Enhanced zipcode lookup using the new canonical PostGIS function
async function findZipcodesInPolygon(polygon: PolygonPoint[]): Promise<string[]> {
  console.log(`Processing polygon with ${polygon.length} points`);
  
  // Create Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  try {
    // Convert polygon to GeoJSON format
    const polygonGeoJSON = {
      type: "Polygon",
      coordinates: [[
        ...polygon.map(p => [p.lng, p.lat]),
        [polygon[0].lng, polygon[0].lat] // Close the polygon
      ]]
    };
    
    console.log('Calling canonical spatial intersection function...');
    
    // Use the new canonical function for spatial intersection
    const { data, error } = await supabase.rpc('compute_zipcodes_for_polygon', {
      polygon_geojson: polygonGeoJSON,
      min_overlap_percent: 0.02 // 2% minimum overlap
    });
    
    if (error) {
      console.error('Canonical spatial query failed:', error);
      throw error;
    }
    
    if (data && data.length > 0) {
      console.log(`Found ${data.length} zipcodes via canonical function:`, data.slice(0, 10));
      return data;
    }
    
    console.log('No zipcodes found via canonical function');
    return [];
    
  } catch (error) {
    console.error('Canonical function query error:', error);
    throw error;
  }
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

    const { polygon, workerId, areaName = 'Service Area', zipcodesOnly } = await req.json();

    // Allow either polygon or zipcodesOnly
    if (!zipcodesOnly && (!polygon || !Array.isArray(polygon) || polygon.length < 3)) {
      throw new Error('Invalid polygon: must have at least 3 points');
    }

    if (!workerId) {
      throw new Error('Worker ID is required');
    }

    console.log(
      `Processing request for worker ${workerId}`,
      { mode: zipcodesOnly ? 'zip-only' : 'polygon', points: Array.isArray(polygon) ? polygon.length : 0 }
    );

    // Find zipcodes within the polygon or use provided ZIP codes
    let zipcodes: string[];
    if (zipcodesOnly && Array.isArray(zipcodesOnly)) {
      zipcodes = zipcodesOnly.filter((zip: string) => /^\d{5}$/.test(zip));
      console.log(`Using provided ZIP codes: ${zipcodes.length} valid ZIPs`);
    } else {
      zipcodes = await findZipcodesInPolygon(polygon);
      console.log(`Found ${zipcodes.length} zipcodes in polygon`);
    }
    
    if (zipcodes.length === 0) {
      console.log('No ZIP codes found for the given polygon');
      return new Response(
        JSON.stringify({
          success: true,
          zipcodes: [],
          message: 'No ZIP codes found within the specified area',
          suggestions: 'Try drawing a larger area or check if the location has valid ZIP code coverage'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        zipcodes: zipcodes,
        count: zipcodes.length,
        areaName: areaName,
        workerId: workerId,
        method: zipcodesOnly ? 'manual_input' : 'spatial_intersection'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Polygon to zipcodes error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});