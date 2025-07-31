import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[TEST] Function started, method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[TEST] CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TEST] Processing POST request');
    const body = await req.json();
    console.log('[TEST] Request body received:', body);

    // Test basic response
    return new Response(JSON.stringify({
      success: true,
      message: 'Function is working',
      receivedData: body
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[TEST] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});