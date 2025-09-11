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
      polygon, 
      workerId, 
      areaName, 
      zipcodesOnly, 
      mode = 'replace_all',
      areaId,
      existingAreaId 
    } = await req.json();

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

    let zipcodes: string[] = [];
    let serviceArea: any;

    if (zipcodesOnly && Array.isArray(zipcodesOnly)) {
      zipcodes = zipcodesOnly;
    } else if (polygon && polygon.length >= 3) {
      // Call the existing polygon-to-zipcodes function
      const { data: polygonResult, error: polygonError } = await supabase.functions.invoke(
        'polygon-to-zipcodes',
        {
          body: { polygon, workerId, areaName, mode }
        }
      );

      if (polygonError) {
        throw new Error(`Polygon processing failed: ${polygonError.message}`);
      }

      return new Response(JSON.stringify(polygonResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (!existingAreaId) {
      throw new Error('Either polygon, zipcodesOnly, or existingAreaId must be provided');
    }

    // Handle adding to existing area
    if (existingAreaId) {
      // Verify the area exists and belongs to the worker
      const { data: existingArea, error: existingAreaError } = await supabase
        .from('worker_service_areas')
        .select('*')
        .eq('id', existingAreaId)
        .eq('worker_id', workerId)
        .eq('is_active', true)
        .single();

      if (existingAreaError || !existingArea) {
        throw new Error('Existing service area not found or not accessible');
      }

      serviceArea = existingArea;
    } else {
      // Handle zipcode-only mode for new areas
      if (mode === 'replace_all') {
        // Delete existing areas for this worker
        await supabase
          .from('worker_service_areas')
          .update({ is_active: false })
          .eq('worker_id', workerId);
      }

      // Create new service area
      const { data: newServiceArea, error: areaError } = await supabase
        .from('worker_service_areas')
        .insert({
          worker_id: workerId,
          area_name: areaName || `Admin Assigned - ${new Date().toLocaleDateString()}`,
          polygon_coordinates: polygon || [],
          is_active: true
        })
        .select()
        .single();

      if (areaError) {
        throw new Error(`Failed to create service area: ${areaError.message}`);
      }

      serviceArea = newServiceArea;
    }

    // Insert zipcodes
    if (zipcodes.length > 0) {
      const zipcodeMappings = zipcodes.map(zipcode => ({
        worker_id: workerId,
        service_area_id: serviceArea.id,
        zipcode: zipcode.trim()
      }));

      const { error: zipError } = await supabase
        .from('worker_service_zipcodes')
        .insert(zipcodeMappings);

      if (zipError) {
        throw new Error(`Failed to insert zipcodes: ${zipError.message}`);
      }
    }

    // Log the action
    console.log(`Admin ${user.email} ${mode === 'replace_all' ? 'replaced' : 'updated'} service areas for worker ${targetWorker.name} with ${zipcodes.length} zip codes`);

    return new Response(JSON.stringify({
      success: true,
      serviceAreaId: serviceArea.id,
      zipcodesCount: zipcodes.length,
      mode,
      message: `Successfully ${mode === 'replace_all' ? 'replaced' : 'updated'} service areas for ${targetWorker.name}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Admin service area management error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});