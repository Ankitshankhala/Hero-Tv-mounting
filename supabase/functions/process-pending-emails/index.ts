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

    console.log('[PROCESS-PENDING-EMAILS] Starting to process pending emails');

    // Fetch all pending emails
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50); // Process up to 50 at a time

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('[PROCESS-PENDING-EMAILS] No pending emails found');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending emails' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PROCESS-PENDING-EMAILS] Found ${pendingEmails.length} pending emails`);

    let successCount = 0;
    let failureCount = 0;

    // Process each pending email
    for (const email of pendingEmails) {
      try {
        console.log(`[PROCESS-PENDING-EMAILS] Processing email ${email.id} - Type: ${email.email_type}`);

        // Invoke unified-email-dispatcher to send the email
        const { data: dispatchResult, error: dispatchError } = await supabase.functions.invoke(
          'unified-email-dispatcher',
          {
            body: {
              bookingId: email.booking_id,
              recipientEmail: email.recipient_email,
              emailType: email.email_type,
            },
          }
        );

        if (dispatchError) {
          // Update status to failed
          await supabase
            .from('email_logs')
            .update({
              status: 'failed',
              error_message: dispatchError.message,
            })
            .eq('id', email.id);

          failureCount++;
          console.error(`[PROCESS-PENDING-EMAILS] Failed to send email ${email.id}: ${dispatchError.message}`);
        } else {
          // If the email was already sent (cached), we still count it as success
          successCount++;
          console.log(`[PROCESS-PENDING-EMAILS] Successfully processed email ${email.id}`);
        }
      } catch (emailError) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        
        // Update status to failed
        await supabase
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', email.id);

        failureCount++;
        console.error(`[PROCESS-PENDING-EMAILS] Error processing email ${email.id}: ${errorMessage}`);
      }
    }

    console.log(`[PROCESS-PENDING-EMAILS] Completed. Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingEmails.length,
        successCount,
        failureCount,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[PROCESS-PENDING-EMAILS] Error: ${errorMessage}`);
    
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
