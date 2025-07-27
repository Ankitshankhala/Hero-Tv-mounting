import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Testing email functionality...');

    // Test the send-worker-assignment-email function
    const { data, error } = await supabase.functions.invoke('send-worker-assignment-email', {
      body: { bookingId: '1364c530-90bc-4673-a249-bcd24a9edfd7' }
    });

    if (error) {
      console.error('Error calling email function:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('Email function response:', data);

    // Check email logs
    const { data: emailLogs, error: logsError } = await supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    return new Response(JSON.stringify({ 
      success: true, 
      emailFunctionResponse: data,
      recentEmailLogs: emailLogs,
      logsError: logsError
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error in test function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});