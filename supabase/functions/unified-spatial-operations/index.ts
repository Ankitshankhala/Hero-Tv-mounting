import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  console.log(`[Spatial Operations] ${step}:`, details || '');
};

interface SpatialRequest {
  operation: 'polygon-to-zipcodes' | 'backfill-service-area' | 'draw-area-save' | 'health-check' | 'service-area-upsert';
  data?: any;
  polygon?: any;
  workerId?: string;
  serviceAreaId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Spatial operation request received');
    
    const { operation, data, polygon, workerId, serviceAreaId }: SpatialRequest = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    logStep('Processing operation', operation);
    
    let result;
    
    switch (operation) {
      case 'polygon-to-zipcodes':
        result = await handlePolygonToZipcodes(supabase, polygon);
        break;
        
      case 'backfill-service-area':
        result = await handleBackfillServiceArea(supabase, serviceAreaId);
        break;
        
      case 'draw-area-save':
        result = await handleDrawAreaSave(supabase, data, workerId);
        break;
        
      case 'health-check':
        result = await handleHealthCheck(supabase);
        break;
        
      case 'service-area-upsert':
        result = await handleServiceAreaUpsert(supabase, data);
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('Error in spatial operation', error.message);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function handlePolygonToZipcodes(supabase: any, polygon: any) {
  logStep('Converting polygon to zipcodes');
  
  if (!polygon || !polygon.coordinates) {
    throw new Error('Invalid polygon data provided');
  }
  
  // Query zipcodes that intersect with the polygon
  const { data: zipcodes, error } = await supabase
    .from('regions')
    .select('zipcode, city, state')
    .overlaps('polygon', `POLYGON((${polygon.coordinates[0].map((coord: number[]) => `${coord[0]} ${coord[1]}`).join(',')}))`);
    
  if (error) {
    throw new Error(`Failed to fetch zipcodes: ${error.message}`);
  }
  
  return { 
    success: true, 
    zipcodes: zipcodes || [],
    count: zipcodes?.length || 0
  };
}

async function handleBackfillServiceArea(supabase: any, serviceAreaId: string) {
  logStep('Backfilling service area zipcodes', serviceAreaId);
  
  if (!serviceAreaId) {
    throw new Error('Service area ID is required');
  }
  
  // Get service area polygon
  const { data: serviceArea, error: areaError } = await supabase
    .from('worker_service_areas')
    .select('polygon, worker_id')
    .eq('id', serviceAreaId)
    .single();
    
  if (areaError || !serviceArea) {
    throw new Error('Service area not found');
  }
  
  // Find zipcodes that intersect with the polygon
  const { data: zipcodes, error: zipError } = await supabase
    .from('regions')
    .select('zipcode')
    .overlaps('polygon', serviceArea.polygon);
    
  if (zipError) {
    throw new Error(`Failed to fetch zipcodes: ${zipError.message}`);
  }
  
  // Insert zipcode mappings
  const zipcodeMappings = zipcodes.map((zip: any) => ({
    service_area_id: serviceAreaId,
    worker_id: serviceArea.worker_id,
    zipcode: zip.zipcode
  }));
  
  const { error: insertError } = await supabase
    .from('worker_service_zipcodes')
    .upsert(zipcodeMappings, { onConflict: 'service_area_id,zipcode' });
    
  if (insertError) {
    throw new Error(`Failed to insert zipcodes: ${insertError.message}`);
  }
  
  return {
    success: true,
    zipcodesAdded: zipcodeMappings.length,
    serviceAreaId
  };
}

async function handleDrawAreaSave(supabase: any, data: any, workerId: string) {
  logStep('Saving drawn area', { workerId, hasData: !!data });
  
  if (!workerId || !data) {
    throw new Error('Worker ID and area data are required');
  }
  
  // Save the service area
  const { data: savedArea, error } = await supabase
    .from('worker_service_areas')
    .insert({
      worker_id: workerId,
      name: data.name || 'Custom Service Area',
      polygon: data.polygon,
      is_active: true
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to save service area: ${error.message}`);
  }
  
  // Backfill zipcodes for the new area
  await handleBackfillServiceArea(supabase, savedArea.id);
  
  return {
    success: true,
    serviceArea: savedArea,
    message: 'Service area saved and zipcodes backfilled'
  };
}

async function handleHealthCheck(supabase: any) {
  logStep('Performing spatial health check');
  
  try {
    // Check database connection
    const { data: dbCheck, error: dbError } = await supabase
      .from('regions')
      .select('count')
      .limit(1);
      
    if (dbError) {
      throw new Error(`Database check failed: ${dbError.message}`);
    }
    
    // Check PostGIS extension
    const { data: gisCheck, error: gisError } = await supabase
      .rpc('postgis_version');
      
    const postgisAvailable = !gisError;
    
    return {
      success: true,
      checks: {
        database: true,
        postgis: postgisAvailable,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    return {
      success: false,
      checks: {
        database: false,
        postgis: false,
        timestamp: new Date().toISOString()
      },
      error: error.message
    };
  }
}

async function handleServiceAreaUpsert(supabase: any, data: any) {
  logStep('Upserting service area');
  
  if (!data) {
    throw new Error('Service area data is required');
  }
  
  const { data: result, error } = await supabase
    .from('worker_service_areas')
    .upsert(data, { onConflict: 'id' })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to upsert service area: ${error.message}`);
  }
  
  return {
    success: true,
    serviceArea: result,
    message: 'Service area upserted successfully'
  };
}