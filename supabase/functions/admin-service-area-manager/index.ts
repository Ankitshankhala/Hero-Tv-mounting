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
      action = 'manage_service_area'
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

    // Handle different actions
    if (action === 'assign_zipcodes_to_area') {
      return await handleAssignZipcodesToArea(supabase, user, workerId, areaId, zipcodesOnly);
    }

    if (action === 'assign_all_unassigned_in_polygon') {
      return await handleAssignAllUnassignedInPolygon(supabase, user, workerId, areaId, polygon);
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
    } else {
      throw new Error('Either polygon or zipcodesOnly must be provided');
    }

    // Handle zipcode-only mode
    if (mode === 'replace_all') {
      // Delete existing areas for this worker
      await supabase
        .from('worker_service_areas')
        .update({ is_active: false })
        .eq('worker_id', workerId);
    }

    // Create new service area
    const { data: serviceArea, error: areaError } = await supabase
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

// Handle ZIP code assignment to existing area
async function handleAssignZipcodesToArea(supabase: any, user: any, workerId: string, areaId: string, zipcodes: string[]) {
  if (!zipcodes || !Array.isArray(zipcodes) || zipcodes.length === 0) {
    throw new Error('Valid ZIP codes array required');
  }

  if (!areaId) {
    throw new Error('Area ID required for ZIP assignment');
  }

  // Verify the area exists and belongs to the worker
  const { data: area, error: areaError } = await supabase
    .from('worker_service_areas')
    .select('id, area_name, worker_id, is_active')
    .eq('id', areaId)
    .eq('worker_id', workerId)
    .eq('is_active', true)
    .single();

  if (areaError || !area) {
    throw new Error('Service area not found or not active');
  }

  // Remove duplicates and get existing assignments
  const uniqueZipcodes = [...new Set(zipcodes.map(z => z.trim()))];
  
  const { data: existing, error: existingError } = await supabase
    .from('worker_service_zipcodes')
    .select('zipcode')
    .eq('worker_id', workerId)
    .in('zipcode', uniqueZipcodes);

  if (existingError) {
    console.warn('Error checking existing ZIP codes:', existingError);
  }

  // Filter out existing assignments
  const existingZips = new Set(existing?.map(e => e.zipcode) || []);
  const newZipcodes = uniqueZipcodes.filter(zip => !existingZips.has(zip));

  if (newZipcodes.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      message: 'All ZIP codes were already assigned to this worker',
      assignedCount: 0,
      skippedCount: uniqueZipcodes.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Insert new ZIP code assignments
  const zipcodeMappings = newZipcodes.map(zipcode => ({
    worker_id: workerId,
    service_area_id: areaId,
    zipcode
  }));

  const { error: insertError } = await supabase
    .from('worker_service_zipcodes')
    .insert(zipcodeMappings);

  if (insertError) {
    throw new Error(`Failed to assign ZIP codes: ${insertError.message}`);
  }

  console.log(`Admin ${user.email} assigned ${newZipcodes.length} ZIP codes to area ${area.area_name} for worker ${workerId}`);

  return new Response(JSON.stringify({
    success: true,
    message: `Successfully assigned ${newZipcodes.length} ZIP codes to ${area.area_name}`,
    assignedCount: newZipcodes.length,
    skippedCount: uniqueZipcodes.length - newZipcodes.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Handle bulk assignment of all unassigned ZIP codes in polygon
async function handleAssignAllUnassignedInPolygon(supabase: any, user: any, workerId: string, areaId: string, polygon: any[]) {
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
    throw new Error('Valid polygon coordinates required');
  }

  if (!areaId) {
    throw new Error('Area ID required for bulk assignment');
  }

  // Get unassigned ZIP codes in polygon
  const { data: zipResult, error: zipError } = await supabase.functions.invoke(
    'zipcodes-in-area',
    {
      body: { polygon, selectedWorkerId: workerId }
    }
  );

  if (zipError || !zipResult?.success) {
    throw new Error(`Failed to get ZIP codes in polygon: ${zipError?.message || 'Unknown error'}`);
  }

  const unassignedZips = zipResult.zipcodes
    .filter((zip: any) => zip.status === 'unassigned')
    .map((zip: any) => zip.zipcode);

  if (unassignedZips.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      message: 'No unassigned ZIP codes found in the area',
      assignedCount: 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Use the existing assignment function
  return await handleAssignZipcodesToArea(supabase, user, workerId, areaId, unassignedZips);
}