import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Environment variables test completed',
        envStatus,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Environment test function error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});