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

    const { workerId, areaName, polygon, polygonGeoJSON, mode, areaIdToUpdate }: DrawAreaRequest = await req.json();

    console.log('🎨 Draw Area Save - Request received:', {
      workerId,
      areaName,
      mode,
      areaIdToUpdate,
      polygonPoints: polygon?.length || 0,
      hasGeoJSON: !!polygonGeoJSON
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

    // Generate GeoJSON if not provided
    let geoJSON = polygonGeoJSON;
    if (!geoJSON) {
      geoJSON = {
        type: "Polygon",
        coordinates: [
          [...polygon.map(p => [p.lng, p.lat]), [polygon[0].lng, polygon[0].lat]]
        ]
      };
      console.log('🗺️ Generated GeoJSON from polygon coordinates');
    }

    let result;
    let areaId;
    let zipCodes: string[] = [];

    if (mode === 'update' && areaIdToUpdate) {
      // Update existing area
      console.log('🔄 Updating existing area:', areaIdToUpdate);
      
      const updateData: any = {
        polygon_coordinates: polygon,
        polygon_geojson: geoJSON,
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
          polygon_coordinates: polygon,
          polygon_geojson: geoJSON,
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

    // Compute ZIP codes using the new unified function
    console.log('🔍 Computing ZIP codes for saved area...');
    try {
      const { data: zipResults, error: zipError } = await supabase
        .rpc('find_zipcodes_in_polygon_geojson', { 
          polygon_geojson: geoJSON,
          min_overlap_percent: 0.1 
        });

      if (zipError) {
        console.error('❌ ZIP code computation failed:', zipError);
      } else if (zipResults && zipResults.length > 0) {
        zipCodes = zipResults.map(r => r.zipcode);
        console.log(`✅ Found ${zipCodes.length} ZIP codes:`, zipCodes.slice(0, 10));
        
        // Insert ZIP codes efficiently
        for (const zipcode of zipCodes.slice(0, 50)) { // Limit to prevent overwhelming
          try {
            await supabase
              .from('worker_service_zipcodes')
              .upsert({
                worker_id: workerId,
                zipcode: zipcode,
                service_area_id: areaId,
                from_polygon: true,
                from_manual: false
              }, { 
                onConflict: 'worker_id,zipcode',
                ignoreDuplicates: false 
              });
          } catch (zipInsertError) {
            // Silently continue on duplicates
          }
        }
        console.log('📍 ZIP codes synchronized successfully');
      } else {
        console.log('⚠️ No ZIP codes found for polygon');
      }
    } catch (zipComputeError) {
      console.error('❌ ZIP computation failed:', zipComputeError);
      // Continue without failing the entire operation
    }

    // Log the operation for audit trail
    await supabase
      .from('service_area_audit_logs')
      .insert({
        worker_id: workerId,
        service_area_id: areaId,
        action: mode === 'create' ? 'area_created' : 'area_updated',
        old_data: mode === 'update' ? { polygon_updated: true } : null,
        new_data: { 
          area_name: areaName, 
          polygon_points: polygon.length,
          method: 'drawing_tool'
        },
        admin_user_id: null, // This could be passed from the frontend if needed
        created_at: new Date().toISOString()
      });

    console.log('📝 Audit log created');

    return new Response(
      JSON.stringify({ 
        success: true, 
        area: result,
        zipCodes: zipCodes,
        zipCodeCount: zipCodes.length,
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