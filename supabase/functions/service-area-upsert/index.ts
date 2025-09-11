// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface UpsertRequest {
  workerId: string;
  areaName: string;
  mode: 'replace_all' | 'append';
  polygon?: PolygonPoint[];
  zipcodesOnly?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.split(' ')[1]);
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Check user permissions
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    if (userData.role !== 'admin' && userData.role !== 'worker') {
      throw new Error('Insufficient permissions');
    }

    // If worker, only allow self-assignment
    if (userData.role === 'worker' && user.id !== req.body.workerId) {
      throw new Error('Workers can only manage their own service areas');
    }

    const requestBody: UpsertRequest = await req.json();
    const { workerId, areaName, mode, polygon, zipcodesOnly } = requestBody;

    // Validate request
    if (!workerId || !areaName) {
      throw new Error('Worker ID and area name are required');
    }

    if (!polygon && !zipcodesOnly) {
      throw new Error('Either polygon or zipcodesOnly must be provided');
    }

    if (polygon && zipcodesOnly) {
      throw new Error('Cannot provide both polygon and zipcodesOnly');
    }

    // Verify worker exists
    const { data: workerData, error: workerError } = await supabase
      .from('users')
      .select('id')
      .eq('id', workerId)
      .eq('role', 'worker')
      .single();

    if (workerError || !workerData) {
      throw new Error('Worker not found');
    }

    let zipcodes: string[] = [];

    if (polygon) {
      // Convert polygon to zipcodes using the polygon-to-zipcodes function
      const { data: polygonResult, error: polygonError } = await supabase.functions.invoke('polygon-to-zipcodes', {
        body: { polygon }
      });

      if (polygonError) {
        throw new Error(`Polygon conversion failed: ${polygonError.message}`);
      }

      if (!polygonResult.success) {
        throw new Error(`Polygon conversion failed: ${polygonResult.error}`);
      }

      zipcodes = polygonResult.zipcodes || [];
    } else if (zipcodesOnly) {
      zipcodes = zipcodesOnly;
    }

    // Remove duplicates and validate
    zipcodes = [...new Set(zipcodes.filter(zip => zip && zip.trim().length === 5))];

    if (zipcodes.length === 0) {
      throw new Error('No valid ZIP codes found');
    }

    // Safe atomic operation for replace_all mode
    let newArea: any;
    
    // Step 1: Create new service area first
    const { data: createdArea, error: areaError } = await supabase
      .from('worker_service_areas')
      .insert({
        worker_id: workerId,
        area_name: areaName,
        polygon_coordinates: polygon || [],
        is_active: true
      })
      .select()
      .single();

    if (areaError || !createdArea) {
      throw new Error(`Failed to create service area: ${areaError?.message}`);
    }

    newArea = createdArea;

    try {
      // Step 2: Insert new zipcodes
      const zipcodeInserts = zipcodes.map(zipcode => ({
        worker_id: workerId,
        service_area_id: newArea.id,
        zipcode
      }));

      const { error: zipcodesError } = await supabase
        .from('worker_service_zipcodes')
        .insert(zipcodeInserts);

      if (zipcodesError) {
        throw new Error(`Failed to insert zipcodes: ${zipcodesError.message}`);
      }

      // Step 3: Only after successful creation, handle replace_all cleanup
      if (mode === 'replace_all') {
        // Deactivate existing service areas for this worker (excluding the new one)
        const { error: deactivateError } = await supabase
          .from('worker_service_areas')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('worker_id', workerId)
          .eq('is_active', true)
          .neq('id', newArea.id);

        if (deactivateError) {
          throw new Error(`Failed to deactivate existing areas: ${deactivateError.message}`);
        }

        // Delete existing zipcodes for other areas of this worker
        const { error: deleteZipsError } = await supabase
          .from('worker_service_zipcodes')
          .delete()
          .eq('worker_id', workerId)
          .neq('service_area_id', newArea.id);

        if (deleteZipsError) {
          throw new Error(`Failed to delete existing zipcodes: ${deleteZipsError.message}`);
        }
      }

    } catch (error) {
      // Rollback: delete the newly created area and its zipcodes on failure
      await supabase
        .from('worker_service_zipcodes')
        .delete()
        .eq('service_area_id', newArea.id);
      
      await supabase
        .from('worker_service_areas')
        .delete()
        .eq('id', newArea.id);
      
      throw error;
    }

    // Create audit log
    const { error: auditError } = await supabase.rpc('create_service_area_audit_log', {
      p_worker_id: workerId,
      p_record_id: newArea.id,
      p_operation: mode === 'replace_all' ? 'upsert_replace' : 'upsert_append',
      p_table_name: 'worker_service_areas',
      p_new_data: {
        area_name: areaName,
        zipcode_count: zipcodes.length,
        mode
      },
      p_old_data: null,
      p_changed_by: user.id
    });

    if (auditError) {
      console.error('Audit log creation failed:', auditError);
      // Don't throw here as the main operation succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Service area '${areaName}' created with ${zipcodes.length} ZIP codes`,
        data: {
          area_id: newArea.id,
          zipcode_count: zipcodes.length,
          zipcodes
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Service area upsert error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});