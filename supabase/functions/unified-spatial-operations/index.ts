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
        if (!serviceAreaId) {
          throw new Error('Service area ID is required for backfill operation');
        }
        result = await handleBackfillServiceArea(supabase, serviceAreaId);
        break;
        
      case 'draw-area-save':
        if (!workerId) {
          throw new Error('Worker ID is required for draw area save operation');
        }
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Error in spatial operation', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
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
  logStep('Enhanced polygon to zipcodes conversion');
  
  if (!polygon || !polygon.coordinates) {
    throw new Error('Invalid polygon data provided');
  }

  try {
    // Use the improved database function for ZIP code computation
    const { data: zipResult, error } = await supabase
      .rpc('compute_zipcodes_for_polygon', {
        p_polygon_coords: polygon
      });

    if (error) {
      logStep('Primary ZIP computation failed, trying fallback', error.message);
      
      // Fallback to comprehensive ZIP code dataset
      const { data: fallbackResult, error: fallbackError } = await supabase
        .rpc('zipcodes_intersecting_polygon', {
          polygon_coords: polygon
        });

      if (fallbackError) {
        throw new Error(`All ZIP code computation methods failed: ${fallbackError.message}`);
      }

      return {
        success: true,
        zipcodes: fallbackResult || [],
        count: fallbackResult?.length || 0,
        method: 'fallback',
        warning: 'Used fallback ZIP code computation method'
      };
    }

    return { 
      success: true, 
      zipcodes: zipResult || [],
      count: zipResult?.length || 0,
      method: 'primary'
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('All ZIP computation methods failed', errorMessage);
    throw error;
  }
}

async function handleBackfillServiceArea(supabase: any, serviceAreaId: string) {
  logStep('Enhanced service area ZIP backfill', serviceAreaId);
  
  if (!serviceAreaId) {
    throw new Error('Service area ID is required');
  }

  try {
    // Use the database function for consistent ZIP code computation
    const { data: result, error } = await supabase
      .rpc('compute_zipcodes_for_service_area', {
        p_service_area_id: serviceAreaId
      });

    if (error) {
      throw new Error(`ZIP code computation failed: ${error.message}`);
    }

    logStep('ZIP backfill completed', { 
      serviceAreaId, 
      zipcodesAdded: result?.zipcodes_added || 0 
    });

    return {
      success: true,
      zipcodesAdded: result?.zipcodes_added || 0,
      serviceAreaId,
      method: 'database_function'
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Enhanced backfill failed, trying manual method', errorMessage);
    
    // Fallback to manual method
    const { data: serviceArea, error: areaError } = await supabase
      .from('worker_service_areas')
      .select('polygon_coordinates, worker_id')
      .eq('id', serviceAreaId)
      .single();
       
    if (areaError || !serviceArea) {
      throw new Error('Service area not found');
    }

    // Use comprehensive ZIP code intersection
    const { data: zipcodes, error: zipError } = await supabase
      .rpc('zipcodes_intersecting_polygon', {
        polygon_coords: serviceArea.polygon_coordinates
      });
       
    if (zipError) {
      throw new Error(`Fallback ZIP computation failed: ${zipError.message}`);
    }

    // Insert zipcode mappings
    if (zipcodes && zipcodes.length > 0) {
      const zipcodeMappings = zipcodes.map((zipcode: string) => ({
        service_area_id: serviceAreaId,
        worker_id: serviceArea.worker_id,
        zipcode: zipcode
      }));
      
      const { error: insertError } = await supabase
        .from('worker_service_zipcodes')
        .upsert(zipcodeMappings, { onConflict: 'service_area_id,zipcode' });
         
      if (insertError) {
        throw new Error(`Failed to insert ZIP codes: ${insertError.message}`);
      }

      return {
        success: true,
        zipcodesAdded: zipcodeMappings.length,
        serviceAreaId,
        method: 'fallback'
      };
    }

    return {
      success: true,
      zipcodesAdded: 0,
      serviceAreaId,
      method: 'fallback',
      warning: 'No ZIP codes found for this polygon'
    };
  }
}

async function handleDrawAreaSave(supabase: any, data: any, workerId: string) {
  logStep('Enhanced draw area save', { workerId, hasData: !!data });
  
  if (!workerId || !data) {
    throw new Error('Worker ID and area data are required');
  }

  // Validate polygon coordinates
  if (!data.polygon || !Array.isArray(data.polygon) || data.polygon.length < 3) {
    throw new Error('Invalid polygon coordinates - need at least 3 points');
  }

  // Convert polygon to GeoJSON format for PostGIS
  const geoJsonPolygon = {
    type: 'Polygon',
    coordinates: [[
      ...data.polygon.map((point: any) => [point.lng || point.lon, point.lat]),
      [data.polygon[0].lng || data.polygon[0].lon, data.polygon[0].lat] // Close polygon
    ]]
  };

  logStep('Converted polygon to GeoJSON', { pointCount: data.polygon.length });

  try {
    let serviceAreaResult;
    
    // Handle create vs update mode
    if (data.mode === 'update' && data.areaIdToUpdate) {
      logStep('Updating existing service area', data.areaIdToUpdate);
      
      const { data: updatedArea, error: updateError } = await supabase
        .from('worker_service_areas')
        .update({
          area_name: data.areaName || 'Updated Service Area',
          polygon_coordinates: geoJsonPolygon,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.areaIdToUpdate)
        .eq('worker_id', workerId) // Security check
        .select()
        .single();
        
      if (updateError) {
        throw new Error(`Failed to update service area: ${updateError.message}`);
      }
      
      serviceAreaResult = updatedArea;
    } else {
      logStep('Creating new service area');
      
      const { data: newArea, error: createError } = await supabase
        .from('worker_service_areas')
        .insert({
          worker_id: workerId,
          area_name: data.areaName || 'New Service Area',
          polygon_coordinates: geoJsonPolygon,
          is_active: true
        })
        .select()
        .single();
        
      if (createError) {
        throw new Error(`Failed to create service area: ${createError.message}`);
      }
      
      serviceAreaResult = newArea;
    }

    // Now compute ZIP codes using the enhanced function
    logStep('Computing ZIP codes for service area', serviceAreaResult.id);
    
    const { data: zipResult, error: zipError } = await supabase
      .rpc('compute_zipcodes_for_service_area', {
        p_service_area_id: serviceAreaResult.id
      });

    if (zipError) {
      logStep('ZIP code computation failed', zipError.message);
      // Don't fail the entire operation if ZIP computation fails
      console.warn('ZIP code computation failed, but service area was saved:', zipError);
    }

    const zipCount = zipResult?.zipcodes_added || 0;
    logStep('ZIP code computation completed', { zipCount });

    return {
      success: true,
      serviceArea: serviceAreaResult,
      zipCodeCount: zipCount,
      message: `Service area ${data.mode === 'update' ? 'updated' : 'created'} successfully`,
      operation: data.mode || 'create'
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Error in draw area save', errorMessage);
    throw error;
  }
}

async function handleHealthCheck(supabase: any) {
  logStep('Comprehensive spatial health check');
  
  const checks: any = {
    timestamp: new Date().toISOString(),
    database: false,
    postgis: false,
    zcta_data: false,
    zip_data: false,
    spatial_functions: false
  };

  let overallSuccess = true;
  const errors: string[] = [];

  try {
    // 1. Database connection check
    const { data: dbCheck, error: dbError } = await supabase
      .from('worker_service_areas')
      .select('count')
      .limit(1);
      
    if (!dbError) {
      checks.database = true;
    } else {
      errors.push(`Database: ${dbError.message}`);
      overallSuccess = false;
    }
    
    // 2. PostGIS extension check
    const { data: gisCheck, error: gisError } = await supabase
      .rpc('postgis_version');
      
    if (!gisError && gisCheck) {
      checks.postgis = true;
      checks.postgis_version = gisCheck;
    } else {
      errors.push('PostGIS extension not available');
      overallSuccess = false;
    }

    // 3. ZCTA polygon data check
    const { data: zctaCount, error: zctaError } = await supabase
      .from('us_zcta_polygons')
      .select('count')
      .limit(1);

    if (!zctaError) {
      checks.zcta_data = true;
      
      // Get actual count
      const { count } = await supabase
        .from('us_zcta_polygons')
        .select('*', { count: 'exact', head: true });
      
      checks.zcta_polygon_count = count;
    } else {
      errors.push(`ZCTA data: ${zctaError.message}`);
    }

    // 4. ZIP code data check
    const { data: zipCount, error: zipError } = await supabase
      .from('comprehensive_zip_codes')
      .select('count')
      .limit(1);

    if (!zipError) {
      checks.zip_data = true;
      
      // Get actual count
      const { count } = await supabase
        .from('comprehensive_zip_codes')
        .select('*', { count: 'exact', head: true });
      
      checks.zip_code_count = count;
    } else {
      errors.push(`ZIP data: ${zipError.message}`);
    }

    // 5. Spatial functions check
    const { data: funcCheck, error: funcError } = await supabase
      .rpc('compute_zipcodes_for_polygon', {
        p_polygon_coords: {
          type: 'Polygon',
          coordinates: [[[-98.5, 39.8], [-98.4, 39.8], [-98.4, 39.9], [-98.5, 39.9], [-98.5, 39.8]]]
        }
      });

    if (!funcError) {
      checks.spatial_functions = true;
      checks.test_polygon_zips = Array.isArray(funcCheck) ? funcCheck.length : 0;
    } else {
      errors.push(`Spatial functions: ${funcError.message}`);
    }

    return {
      success: overallSuccess,
      checks,
      errors: errors.length > 0 ? errors : undefined,
      recommendations: generateHealthRecommendations(checks)
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      checks,
      errors: [...errors, errorMessage],
      recommendations: ['Check database connectivity', 'Verify PostGIS installation']
    };
  }
}

function generateHealthRecommendations(checks: any): string[] {
  const recommendations: string[] = [];
  
  if (!checks.database) {
    recommendations.push('Fix database connectivity issues');
  }
  
  if (!checks.postgis) {
    recommendations.push('Install PostGIS extension');
  }
  
  if (!checks.zcta_data) {
    recommendations.push('Load ZCTA polygon data using the data upload feature');
  }
  
  if (!checks.zip_data) {
    recommendations.push('Load comprehensive ZIP code data');
  }
  
  if (!checks.spatial_functions) {
    recommendations.push('Fix spatial computation functions');
  }
  
  if (checks.zcta_polygon_count && checks.zcta_polygon_count < 30000) {
    recommendations.push('ZCTA data appears incomplete - reload dataset');
  }
  
  if (checks.zip_code_count && checks.zip_code_count < 40000) {
    recommendations.push('ZIP code data appears incomplete - reload dataset');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All systems operational - ready for production use');
  }
  
  return recommendations;
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