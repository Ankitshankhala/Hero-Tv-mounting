import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UtilityRequest {
  operation: 'warm-up' | 'test-env-vars';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = performance.now();
    
    const { operation }: UtilityRequest = await req.json().catch(() => ({ operation: 'warm-up' }));
    
    let result;
    
    switch (operation) {
      case 'warm-up':
        result = await handleWarmUp(startTime);
        break;
        
      case 'test-env-vars':
        result = await handleTestEnvVars();
        break;
        
      default:
        // Default to warm-up for backward compatibility
        result = await handleWarmUp(startTime);
    }
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function handleWarmUp(startTime: number) {
  // Simple warm-up function to keep edge functions active
  return {
    timestamp: new Date().toISOString(),
    status: 'warm',
    uptime_ms: performance.now() - startTime,
    operation: 'warm-up'
  };
}

async function handleTestEnvVars() {
  console.log('=== Environment Variables Test Function Started ===');
  
  // Test environment variables without exposing their values
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  const envStatus = {
    SUPABASE_URL: {
      exists: !!supabaseUrl,
      length: supabaseUrl?.length || 0,
      startsWith: supabaseUrl?.substring(0, 8) || 'N/A'
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      exists: !!serviceRoleKey,
      length: serviceRoleKey?.length || 0,
      startsWith: serviceRoleKey?.substring(0, 8) || 'N/A'
    },
    SUPABASE_ANON_KEY: {
      exists: !!anonKey,
      length: anonKey?.length || 0,
      startsWith: anonKey?.substring(0, 8) || 'N/A'
    }
  };
  
  console.log('Environment variables status:', envStatus);
  
  return { 
    success: true, 
    message: 'Environment variables test completed',
    envStatus,
    timestamp: new Date().toISOString(),
    operation: 'test-env-vars'
  };
}
