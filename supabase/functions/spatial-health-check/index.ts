import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running spatial health check...');

    // Call the database health check function
    const { data, error } = await supabase.rpc('check_spatial_health');

    if (error) {
      console.error('Health check failed:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log('Health check results:', data);

    return new Response(JSON.stringify({
      success: true,
      health_data: data,
      timestamp: new Date().toISOString(),
      recommendations: generateRecommendations(data)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Spatial health check error:', error);
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

function generateRecommendations(healthData: any): string[] {
  const recommendations: string[] = [];
  
  if (healthData.overall_health === 'unhealthy') {
    recommendations.push('🚨 Critical: The spatial system is not functioning properly');
  }
  
  if (healthData.zcta_polygons_count === 0) {
    recommendations.push('📍 Import US Census ZCTA polygon data for accurate ZIP code coverage');
    recommendations.push('💡 Until ZCTA data is imported, the system will use centroid-based fallback methods');
  }
  
  if (healthData.us_zip_codes_count < 40000) {
    recommendations.push('📮 US ZIP codes table appears incomplete - consider updating');
  }
  
  if (healthData.sample_test_success === false) {
    recommendations.push('⚠️ PostGIS spatial queries are failing - check function implementation');
  }
  
  if (healthData.overall_health === 'healthy') {
    recommendations.push('✅ All spatial systems are functioning correctly');
  } else if (healthData.overall_health === 'degraded_no_polygons') {
    recommendations.push('⚠️ System is functional but using fallback methods due to missing ZCTA polygons');
  }
  
  return recommendations;
}