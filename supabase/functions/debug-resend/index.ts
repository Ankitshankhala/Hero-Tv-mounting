import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== RESEND DEBUG START ===');
    
    // Check if the API key exists
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    console.log('RESEND_API_KEY exists:', !!resendApiKey);
    console.log('RESEND_API_KEY length:', resendApiKey?.length || 0);
    console.log('RESEND_API_KEY starts with re_:', resendApiKey?.startsWith('re_') || false);
    
    if (!resendApiKey) {
      console.log('❌ RESEND_API_KEY is not set');
      return new Response(JSON.stringify({
        success: false,
        error: 'RESEND_API_KEY environment variable is not set',
        hasKey: false
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Try to import Resend
    console.log('Attempting to import Resend...');
    const { Resend } = await import("npm:resend@2.0.0");
    console.log('✅ Resend imported successfully');

    // Initialize Resend
    console.log('Initializing Resend client...');
    const resend = new Resend(resendApiKey);
    console.log('✅ Resend client initialized');

    // Try a simple API call (get domains)
    console.log('Testing Resend API connection...');
    try {
      const domains = await resend.domains.list();
      console.log('✅ Resend API connection successful');
      console.log('Domains:', domains);
    } catch (apiError) {
      console.log('❌ Resend API connection failed:', apiError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Resend API connection failed',
        details: apiError.message,
        hasKey: true,
        keyValid: false
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('=== RESEND DEBUG END ===');

    return new Response(JSON.stringify({
      success: true,
      message: 'Resend is properly configured',
      hasKey: true,
      keyValid: true,
      keyLength: resendApiKey.length,
      keyFormat: resendApiKey.startsWith('re_') ? 'correct' : 'incorrect'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('=== RESEND DEBUG ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});