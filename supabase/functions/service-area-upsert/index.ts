import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface UpsertRequest {
  workerId: string;
  areaName?: string;
  mode: 'replace_all' | 'append';
  // Either polygon OR zipcodesOnly should be provided
  polygon?: PolygonPoint[];
  zipcodesOnly?: string[];
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Parse request body
    const { 
      workerId, 
      areaName, 
      mode = 'append',
      polygon,
      zipcodesOnly
    }: UpsertRequest = await req.json();

    // Get requesting user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    // Authorization check
    const isAdmin = userData.role === 'admin';
    const isWorkerSelf = userData.role === 'worker' && user.id === workerId;

    if (!isAdmin && !isWorkerSelf) {
      throw new Error('Unauthorized: Cannot manage service areas for other workers');
    }

    // Validate target worker exists
    const { data: targetWorker, error: workerError } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', workerId)
      .eq('role', 'worker')
      .single();

    if (workerError || !targetWorker) {
      throw new Error('Target worker not found');
    }

    // Validate input
    if (!polygon && !zipcodesOnly) {
      throw new Error('Either polygon or zipcodesOnly must be provided');
    }

    if (polygon && zipcodesOnly) {
      throw new Error('Provide either polygon or zipcodesOnly, not both');
    }

    let zipcodes: string[] = [];

    // If polygon provided, convert to zipcodes
    if (polygon && polygon.length >= 3) {
      console.log(`Converting polygon with ${polygon.length} points to zipcodes for worker ${workerId}`);
      
      // Call polygon-to-zipcodes for conversion only
      const { data: polygonResult, error: polygonError } = await supabase.functions.invoke(
        'polygon-to-zipcodes',
        {
          body: { 
            polygon, 
            workerId, 
            areaName: areaName || `Area - ${new Date().toLocaleDateString()}`,
            mode: 'convert_only' // Special mode for conversion only
          }
        }
      );

      if (polygonError) {
        throw new Error(`Polygon processing failed: ${polygonError.message}`);
      }

      zipcodes = polygonResult.zipcodes || [];
      console.log(`Polygon converted to ${zipcodes.length} zipcodes`);
    } else if (zipcodesOnly) {
      // Use provided zipcodes directly
      zipcodes = zipcodesOnly.map(zip => zip.trim()).filter(zip => zip.length >= 5);
      console.log(`Using ${zipcodes.length} provided zipcodes`);
    }

    // Remove duplicates
    zipcodes = [...new Set(zipcodes)];

    if (zipcodes.length === 0) {
      throw new Error('No valid ZIP codes found');
    }

    // Handle replace_all mode - unified behavior
    if (mode === 'replace_all') {
      console.log(`Replace mode: Deactivating existing areas and deleting ZIP mappings for worker ${workerId}`);
      
      // Deactivate existing service areas
      await supabase
        .from('worker_service_areas')
        .update({ is_active: false })
        .eq('worker_id', workerId);

      // Delete existing ZIP code mappings
      await supabase
        .from('worker_service_zipcodes')
        .delete()
        .eq('worker_id', workerId);
    }

    // Create new service area
    const finalAreaName = areaName || (polygon ? 'Map Area' : 'Manual Entry') + ` - ${new Date().toLocaleDateString()}`;
    
    const { data: serviceArea, error: areaError } = await supabase
      .from('worker_service_areas')
      .insert({
        worker_id: workerId,
        area_name: finalAreaName,
        polygon_coordinates: polygon || [],
        is_active: true
      })
      .select()
      .single();

    if (areaError) {
      throw new Error(`Failed to create service area: ${areaError.message}`);
    }

    // Insert zipcodes
    const zipcodeMappings = zipcodes.map(zipcode => ({
      worker_id: workerId,
      service_area_id: serviceArea.id,
      zipcode: zipcode
    }));

    const { error: zipError } = await supabase
      .from('worker_service_zipcodes')
      .insert(zipcodeMappings);

    if (zipError) {
      throw new Error(`Failed to insert zipcodes: ${zipError.message}`);
    }

    // Create audit log
    try {
      await supabase.rpc('create_service_area_audit_log', {
        p_table_name: 'worker_service_areas',
        p_operation: 'INSERT',
        p_record_id: serviceArea.id,
        p_new_data: {
          area_name: finalAreaName,
          polygon_coordinates: polygon || [],
          zipcodes: zipcodes,
          mode: mode
        },
        p_worker_id: workerId,
        p_area_name: finalAreaName
      });
    } catch (auditError) {
      console.error('Audit log failed:', auditError);
      // Don't fail the main operation for audit issues
    }

    // Log the action
    const actionType = polygon ? 'polygon' : 'manual';
    const modeText = mode === 'replace_all' ? 'replaced all' : 'appended to';
    console.log(`User ${user.email} ${modeText} service areas for worker ${targetWorker.name} via ${actionType} with ${zipcodes.length} zip codes`);

    return new Response(JSON.stringify({
      success: true,
      serviceAreaId: serviceArea.id,
      zipcodesCount: zipcodes.length,
      zipcodes: zipcodes,
      mode,
      areaName: finalAreaName,
      method: polygon ? 'polygon' : 'manual',
      message: `Successfully ${mode === 'replace_all' ? 'replaced' : 'added'} ${zipcodes.length} ZIP codes for ${targetWorker.name}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Service area upsert error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});