import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DrawAreaRequest {
  workerId: string;
  areaName: string;
  polygon: Array<{ lat: number; lng: number }>;
  polygonGeoJSON?: any;
  mode: 'create' | 'update';
  areaIdToUpdate?: string;
  overlapThreshold?: number;
}

// Convert polygon coordinates to proper GeoJSON format
function normalizeToGeoJSON(polygon: Array<{ lat: number; lng: number }>): any {
  if (!polygon || polygon.length < 3) {
    throw new Error('Polygon must have at least 3 points');
  }
  
  // Convert to [lng, lat] format and ensure polygon is closed
  const coordinates = polygon.map(p => [p.lng, p.lat]);
  
  // Close the polygon if not already closed
  if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
      coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
    coordinates.push([coordinates[0][0], coordinates[0][1]]);
  }
  
  return {
    type: "Polygon",
    coordinates: [coordinates]
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { workerId, areaName, polygon, polygonGeoJSON, mode, areaIdToUpdate, overlapThreshold = 2 }: DrawAreaRequest = await req.json();

    console.log('🎨 Draw Area Save - Request received:', {
      workerId,
      areaName,
      mode,
      areaIdToUpdate,
      polygonPoints: polygon?.length || 0,
      hasGeoJSON: !!polygonGeoJSON,
      overlapThreshold
    });

    // Validate inputs
    if (!workerId || !polygon || polygon.length < 3) {
      console.error('❌ Invalid input data');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields or invalid polygon' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (mode === 'create' && !areaName) {
      console.error('❌ Area name required for new areas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Area name is required for new areas' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify worker exists
    const { data: worker, error: workerError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', workerId)
      .eq('role', 'worker')
      .eq('is_active', true)
      .single();

    if (workerError || !worker) {
      console.error('❌ Worker validation failed:', workerError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Worker not found or inactive' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Worker validated:', worker.id);

    // Normalize polygon to proper GeoJSON format
    const geoJSON = polygonGeoJSON || normalizeToGeoJSON(polygon);
    console.log('🗺️ Normalized GeoJSON polygon');

    let result;
    let areaId;
    let zipCodes: string[] = [];

    if (mode === 'update' && areaIdToUpdate) {
      // Update existing area
      console.log('🔄 Updating existing area:', areaIdToUpdate);
      
      const updateData: any = {
        polygon_coordinates: geoJSON, // Store as GeoJSON now
        updated_at: new Date().toISOString()
      };

      if (areaName) {
        updateData.area_name = areaName;
      }

      const { data: updatedArea, error: updateError } = await supabase
        .from('worker_service_areas')
        .update(updateData)
        .eq('id', areaIdToUpdate)
        .eq('worker_id', workerId)
        .select('*')
        .single();

      if (updateError) {
        console.error('❌ Update failed:', updateError);
        throw updateError;
      }

      result = updatedArea;
      areaId = areaIdToUpdate;
      console.log('✅ Area updated successfully');

    } else {
      // Create new area
      console.log('🆕 Creating new area:', areaName);
      
      const { data: newArea, error: createError } = await supabase
        .from('worker_service_areas')
        .insert({
          worker_id: workerId,
          area_name: areaName,
          polygon_coordinates: geoJSON, // Store as GeoJSON now
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (createError) {
        console.error('❌ Create failed:', createError);
        throw createError;
      }

      result = newArea;
      areaId = newArea.id;
      console.log('✅ Area created successfully:', areaId);
    }

    // Compute ZIP codes using the new canonical function
    console.log(`🔍 Computing ZIP codes with ${overlapThreshold}% minimum overlap...`);
    try {
      const { data: computedZips, error: zipError } = await supabase.rpc('compute_zipcodes_for_service_area', {
        service_area_id: areaId,
        min_overlap_percent: overlapThreshold
      });

      if (zipError) {
        console.error('❌ ZIP code computation failed:', zipError);
        // Fallback to direct polygon computation
        const { data: fallbackZips, error: fallbackError } = await supabase.rpc('compute_zipcodes_for_polygon', {
          polygon_geojson: geoJSON,
          min_overlap_percent: overlapThreshold
        });
        
        if (fallbackError) {
          console.error('❌ Fallback ZIP code computation also failed:', fallbackError);
        } else {
          zipCodes = fallbackZips || [];
          console.log(`✅ Fallback found ${zipCodes.length} ZIP codes:`, zipCodes.slice(0, 10));
          
          // Manually insert ZIP codes since service area function failed
          if (zipCodes.length > 0) {
            await supabase
              .from('worker_service_zipcodes')
              .delete()
              .eq('service_area_id', areaId);
              
            const zipInserts = zipCodes.map(zipcode => ({
              worker_id: workerId,
              service_area_id: areaId,
              zipcode
            }));
            
            await supabase
              .from('worker_service_zipcodes')
              .insert(zipInserts);
          }
        }
      } else {
        zipCodes = computedZips || [];
        console.log(`✅ Successfully computed ${zipCodes.length} ZIP codes:`, zipCodes.slice(0, 10));
      }
    } catch (zipComputeError) {
      console.error('❌ Unexpected error during ZIP code computation:', zipComputeError);
    }

    console.log('📝 Service area operation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        area: result,
        areaId: areaId,
        zipCodes: zipCodes.slice(0, 20), // Return first 20 for verification
        zipCodeCount: zipCodes.length,
        overlapThreshold,
        message: mode === 'create' ? 'Service area created successfully' : 'Service area updated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Draw Area Save - Error:', error);
    
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