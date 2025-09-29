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
      hasZipCodes: !!requestBody.zipCodes,
      zipCodeCount: requestBody.zipCodes?.length,
      mode: requestBody.mode
    });

    const { 
      workerId, 
      polygon, 
      areaIdToUpdate, 
      areaName, 
      mode, 
      zipCodes: preComputedZipCodes,
      // Handle backward compatibility
      areaId: legacyAreaId,
      zipcodes: legacyZipcodes
    } = requestBody;

    // Map legacy parameters for backward compatibility
    const actualAreaId = areaIdToUpdate || legacyAreaId;
    const actualZipCodes = preComputedZipCodes || legacyZipcodes;

    if (!workerId) {
      throw new Error('Invalid request: workerId is required');
    }

    // Allow requests with either polygon OR (areaId + zipCodes) for sync operations
    if (!polygon && !actualZipCodes) {
      throw new Error('Invalid request: either polygon or pre-computed zipCodes are required');
    }

    if (polygon && (!Array.isArray(polygon) || polygon.length < 3)) {
      throw new Error('Invalid request: polygon must have at least 3 points');
    }

    // Convert polygon to GeoJSON format for PostGIS (only if polygon exists)
    let geoJsonPolygon;
    if (polygon && polygon.length > 0) {
      geoJsonPolygon = {
        type: 'Polygon',
        coordinates: [[
          ...polygon.map((point: any) => [point.lng || point.lon, point.lat]),
          [polygon[0].lng || polygon[0].lon, polygon[0].lat] // Close polygon
        ]]
      };
      logStep('Converted polygon to GeoJSON', { pointCount: polygon.length });
    }

    let serviceAreaResult;
    let operation = 'created';

    // Handle create vs update mode
    if ((mode === 'update' || mode === 'append') && actualAreaId) {
      logStep('Updating existing service area', actualAreaId);
      
      const updateData: any = {
        area_name: areaName || 'Updated Service Area',
        updated_at: new Date().toISOString()
      };
      
      // Only update polygon if provided
      if (polygon && polygon.length > 0) {
        updateData.polygon_coordinates = polygon;
      }
      
      const { data: updatedArea, error: updateError } = await supabase
        .from('worker_service_areas')
        .update(updateData)
        .eq('id', actualAreaId)
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

    // Use database-only approach for ZIP code computation
    let zipcodes: string[] = [];
    let skippedCount = 0;
    
    if (actualZipCodes && Array.isArray(actualZipCodes) && actualZipCodes.length > 0) {
      zipcodes = actualZipCodes;
      logStep('Using pre-computed ZIP codes from client', { count: zipcodes.length });
    } else if (polygon && polygon.length > 0) {
      logStep('Computing ZIP codes using database-only ZCTA spatial queries');
      
      try {
        // Ensure geoJsonPolygon is defined
        if (!geoJsonPolygon) {
          throw new Error('GeoJSON polygon is undefined');
        }
        
        // Primary: Use ZCTA spatial intersection function
        const { data: zctaCodes, error: zctaError } = await supabase.rpc('get_zcta_codes_for_polygon', {
          polygon_coords: geoJsonPolygon.coordinates[0]
        });

        if (zctaError || !zctaCodes || zctaCodes.length === 0) {
          logStep('ZCTA spatial query failed or empty, using ZIP code fallback', zctaError?.message);
          
          // Fallback: Direct spatial query against ZIP codes using PostGIS
          const polygonWKT = `POLYGON((${geoJsonPolygon.coordinates[0].map(coord => `${coord[0]} ${coord[1]}`).join(', ')}))`;
          
          const { data: spatialZips, error: spatialError } = await supabase
            .from('us_zip_codes')
            .select('zipcode')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .filter('location', 'intersects', `ST_GeomFromText('${polygonWKT}', 4326)`);
            
          if (!spatialError && spatialZips && spatialZips.length > 0) {
            zipcodes = spatialZips.map(z => z.zipcode);
            logStep('Used PostGIS spatial intersection fallback', { count: zipcodes.length });
          } else {
            // Final fallback: Bounding box approach
            const bounds = calculateBounds(polygon);
            logStep('Using bounding box fallback as last resort', { bounds });
            
            const { data: boundedZips, error: boundedError } = await supabase
              .from('us_zip_codes')
              .select('zipcode')
              .gte('latitude', bounds.south)
              .lte('latitude', bounds.north)
              .gte('longitude', bounds.west)
              .lte('longitude', bounds.east)
              .limit(100); // Prevent excessive results
                
            if (!boundedError && boundedZips) {
              zipcodes = boundedZips.map(z => z.zipcode);
              logStep('Used bounded query fallback', { count: zipcodes.length });
            } else {
              logStep('All spatial queries failed', { boundedError });
              zipcodes = [];
            }
          }
        } else {
          zipcodes = zctaCodes;
          logStep('ZCTA spatial intersection successful', { count: zipcodes.length });
        }
      } catch (computeError) {
        logStep('All ZIP computation methods failed', computeError);
        zipcodes = [];
      }
    }

    // Handle mode-specific logic for existing ZIP codes
    if (mode === 'append' && actualAreaId) {
      // Get existing ZIP codes
      const { data: existingZips } = await supabase
        .from('worker_service_zipcodes')
        .select('zipcode')
        .eq('service_area_id', actualAreaId);
        
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

    // Store ZIP codes in worker_service_zipcodes table
    if (zipcodes.length > 0) {
      logStep('Storing ZIP codes in database', { count: zipcodes.length });
      
      // Clear existing ZIP codes for this service area (if updating)
      await supabase
        .from('worker_service_zipcodes')
        .delete()
        .eq('service_area_id', serviceAreaResult.id);
      
      // Insert new ZIP codes in batches using UPSERT to handle duplicates
      const batchSize = 100;
      for (let i = 0; i < zipcodes.length; i += batchSize) {
        const batch = zipcodes.slice(i, i + batchSize);
        const zipInserts = batch.map(zipcode => ({
          worker_id: workerId,
          service_area_id: serviceAreaResult.id,
          zipcode: zipcode,
          from_polygon: true,
          from_manual: false
        }));
        
        // Use UPSERT to handle duplicate (worker_id, zipcode) constraints
        const { error: zipInsertError } = await supabase
          .from('worker_service_zipcodes')
          .upsert(zipInserts, {
            onConflict: 'worker_id,zipcode',
            ignoreDuplicates: false
          });
          
        if (zipInsertError) {
          logStep('Failed to upsert ZIP batch', { batch: i/batchSize + 1, error: zipInsertError.message });
          throw new Error(`Failed to insert ZIP codes: ${zipInsertError.message}`);
        }
      }
      
      logStep('ZIP codes stored successfully', { total: zipcodes.length });
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Service area upsert failed', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
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