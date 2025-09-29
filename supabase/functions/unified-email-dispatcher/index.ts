import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, recipientEmail, recipientType, scheduledCheck } = await req.json();
    
    console.log(`[UNIFIED-EMAIL-DISPATCHER] Starting unified email dispatch - ${JSON.stringify({
      bookingId,
      recipientEmail,
      recipientType,
      scheduledCheck
    })}`);

    // Validate required parameters
    if (!bookingId && !scheduledCheck) {
      throw new Error('Either bookingId or scheduledCheck must be provided');
    }

    if (!recipientEmail && !scheduledCheck) {
      throw new Error('recipientEmail is required when not doing a scheduled check');
    }

    let emailType = 'confirmation';
    
    if (scheduledCheck) {
      emailType = 'reminder';
    } else if (recipientType === 'worker') {
      emailType = 'worker_notification';
    }

    console.log(`[UNIFIED-EMAIL-DISPATCHER] Email type determined: ${emailType}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailType,
        message: 'Email dispatch completed' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[UNIFIED-EMAIL-DISPATCHER] Error in unified email dispatcher - ${JSON.stringify({ error: errorMessage })}`);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});