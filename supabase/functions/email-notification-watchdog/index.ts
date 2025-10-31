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

    console.log('[EMAIL-WATCHDOG] Starting watchdog check');

    // Find pending emails older than 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data: stuckEmails, error: fetchError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', twoMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(20); // Process up to 20 stuck emails at a time

    if (fetchError) {
      throw new Error(`Failed to fetch stuck emails: ${fetchError.message}`);
    }

    if (!stuckEmails || stuckEmails.length === 0) {
      console.log('[EMAIL-WATCHDOG] No stuck emails found');
      return new Response(
        JSON.stringify({ success: true, retriedCount: 0, message: 'No stuck emails' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[EMAIL-WATCHDOG] Found ${stuckEmails.length} stuck emails`);

    let retriedCount = 0;

    // Retry sending each stuck email
    for (const email of stuckEmails) {
      try {
        console.log(`[EMAIL-WATCHDOG] Retrying email ${email.id} - Type: ${email.email_type}`);

        // Invoke process-pending-emails to handle the retry
        await supabase.functions.invoke('process-pending-emails');
        
        retriedCount++;
      } catch (retryError) {
        console.error(`[EMAIL-WATCHDOG] Error retrying email ${email.id}:`, retryError);
      }
    }

    console.log(`[EMAIL-WATCHDOG] Completed. Retried ${retriedCount} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        retriedCount,
        foundStuckEmails: stuckEmails.length,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[EMAIL-WATCHDOG] Error: ${errorMessage}`);
    
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
