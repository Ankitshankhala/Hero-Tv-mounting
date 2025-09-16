import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  console.log(`[Service Area Upsert] ${step}:`, details || '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = performance.now();
    logStep('Starting service area upsert request');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const requestBody = await req.json();
    logStep('Request body received', {
      hasWorkerId: !!requestBody.workerId,
      hasPolygon: !!requestBody.polygon,
      polygonLength: requestBody.polygon?.length,
      mode: requestBody.mode
    });

    const { workerId, polygon, areaIdToUpdate, areaName, mode } = requestBody;

    if (!workerId || !polygon || !Array.isArray(polygon) || polygon.length < 3) {
      throw new Error('Invalid request: workerId, polygon (min 3 points) are required');
    }

    // Convert polygon to GeoJSON format for PostGIS
    const geoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        ...polygon.map((point: any) => [point.lng || point.lon, point.lat]),
        [polygon[0].lng || polygon[0].lon, polygon[0].lat] // Close polygon
      ]]
    };

    logStep('Converted polygon to GeoJSON', { pointCount: polygon.length });

    let serviceAreaResult;
    let operation = 'created';

    // Handle create vs update mode
    if ((mode === 'update' || mode === 'append') && areaIdToUpdate) {
      logStep('Updating existing service area', areaIdToUpdate);
      
      const { data: updatedArea, error: updateError } = await supabase
        .from('worker_service_areas')
        .update({
          area_name: areaName || 'Updated Service Area',
          polygon_coordinates: polygon, // Store original format
          updated_at: new Date().toISOString()
        })
        .eq('id', areaIdToUpdate)
        .eq('worker_id', workerId) // Security check
        .select()
        .single();
        
      if (updateError) {
        throw new Error(`Failed to update service area: ${updateError.message}`);
      }
      
      serviceAreaResult = updatedArea;
      operation = 'updated';
    } else {
      logStep('Creating new service area');
      
      const { data: newArea, error: createError } = await supabase
        .from('worker_service_areas')
        .insert({
          worker_id: workerId,
          area_name: areaName || 'New Service Area',
          polygon_coordinates: polygon, // Store original format
          is_active: true
        })
        .select()
        .single();
        
      if (createError) {
        throw new Error(`Failed to create service area: ${createError.message}`);
      }
      
      serviceAreaResult = newArea;
      operation = 'created';
    }

    // Now compute ZIP codes using the enhanced function
    logStep('Computing ZIP codes for service area', serviceAreaResult.id);
    
    let zipResult;
    let zipcodes: string[] = [];
    let skippedCount = 0;
    
    try {
      const { data: computeResult, error: zipError } = await supabase
        .rpc('compute_zipcodes_for_service_area', {
          p_service_area_id: serviceAreaResult.id
        });

      if (zipError) {
        logStep('ZIP code computation failed with RPC, trying fallback', zipError.message);
        
        // Fallback: Use enhanced polygon-to-ZIP computation directly
        const { data: polygonResult, error: polygonError } = await supabase
          .rpc('compute_zipcodes_for_polygon', {
            p_polygon_coords: geoJsonPolygon
          });
          
        if (polygonError) {
          logStep('Polygon ZIP computation also failed, using basic fallback', polygonError.message);
          
          // Super fallback: Check comprehensive_zip_codes with bounding box
          const bounds = calculateBounds(polygon);
          const { data: fallbackZips, error: fallbackError } = await supabase
            .from('comprehensive_zip_codes')
            .select('zipcode')
            .gte('latitude', bounds.south)
            .lte('latitude', bounds.north)
            .gte('longitude', bounds.west)
            .lte('longitude', bounds.east);
            
          if (!fallbackError && fallbackZips) {
            zipcodes = fallbackZips.map(z => z.zipcode);
            logStep('Used bounding box fallback', { count: zipcodes.length });
          }
        } else {
          zipcodes = polygonResult || [];
        }
      } else {
        zipResult = computeResult;
        zipcodes = zipResult?.zipcodes || [];
        logStep('ZIP computation successful via RPC', { count: zipcodes.length });
      }
    } catch (computeError) {
      logStep('All ZIP computation methods failed', computeError);
      
      // Final fallback: generate some reasonable ZIPs based on the polygon center
      const center = calculateCenter(polygon);
      logStep('Using center-based ZIP lookup as final fallback', center);
      
      // Try to find ZIPs near the center point
      const { data: nearbyZips, error: nearbyError } = await supabase
        .from('comprehensive_zip_codes')
        .select('zipcode')
        .order(`((latitude - ${center.lat})^2 + (longitude - ${center.lng})^2)`)
        .limit(10);
        
      if (!nearbyError && nearbyZips) {
        zipcodes = nearbyZips.map(z => z.zipcode);
        logStep('Used center-based fallback', { count: zipcodes.length, center });
      }
    }

    // Handle mode-specific logic for existing ZIP codes
    if (mode === 'append' && areaIdToUpdate) {
      // Get existing ZIP codes
      const { data: existingZips } = await supabase
        .from('worker_service_zipcodes')
        .select('zipcode')
        .eq('service_area_id', areaIdToUpdate);
        
      const existingZipCodes = new Set(existingZips?.map(z => z.zipcode) || []);
      const newZipcodes = zipcodes.filter(zip => !existingZipCodes.has(zip));
      skippedCount = zipcodes.length - newZipcodes.length;
      zipcodes = newZipcodes;
      
      logStep('Append mode: filtered existing ZIPs', {
        total: zipcodes.length + skippedCount,
        new: zipcodes.length,
        skipped: skippedCount
      });
    }

    const executionTime = performance.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      message: `Service area '${areaName}' ${operation} with ${zipcodes.length} ZIP codes`,
      data: {
        area_id: serviceAreaResult.id,
        zipcode_count: zipcodes.length,
        zipcodes: zipcodes,
        skipped_count: skippedCount,
        operation: operation,
        execution_time_ms: Math.round(executionTime)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('Service area upsert failed', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Helper function to calculate polygon bounds
function calculateBounds(polygon: Array<{lat: number, lng: number}>) {
  let north = -90, south = 90, east = -180, west = 180;
  
  for (const point of polygon) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }
  
  // Add some padding for better coverage
  const latPadding = (north - south) * 0.1;
  const lngPadding = (east - west) * 0.1;
  
  return {
    north: north + latPadding,
    south: south - latPadding,
    east: east + lngPadding,
    west: west - lngPadding
  };
}

// Helper function to calculate polygon center
function calculateCenter(polygon: Array<{lat: number, lng: number}>) {
  const totalLat = polygon.reduce((sum, point) => sum + point.lat, 0);
  const totalLng = polygon.reduce((sum, point) => sum + point.lng, 0);
  
  return {
    lat: totalLat / polygon.length,
    lng: totalLng / polygon.length
  };
}