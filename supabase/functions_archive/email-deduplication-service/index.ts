import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailDeduplicationRequest {
  bookingId: string;
  workerId: string;
  emailType: 'worker_assignment' | 'customer_confirmation';
  force?: boolean;
  source?: string; // 'trigger' | 'manual' | 'retry'
}

interface DeduplicationResult {
  shouldSend: boolean;
  reason: string;
  existingEmailId?: string;
  cooldownUntil?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== EMAIL DEDUPLICATION SERVICE ===');
    
    const { bookingId, workerId, emailType, force = false, source = 'unknown' }: EmailDeduplicationRequest = await req.json();
    console.log('Deduplication check:', { bookingId, workerId, emailType, force, source });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get worker email for deduplication key
    const { data: worker, error: workerError } = await supabase
      .from('users')
      .select('email')
      .eq('id', workerId)
      .maybeSingle();

    if (workerError || !worker?.email) {
      console.error('Worker not found or missing email:', workerError);
      return new Response(JSON.stringify({
        shouldSend: false,
        reason: 'Worker not found or missing email',
        error: true
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const result = await checkDeduplication(supabase, {
      bookingId,
      workerEmail: worker.email,
      emailType,
      force,
      source
    });

    console.log('Deduplication result:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Deduplication service error:', error);
    return new Response(JSON.stringify({
      shouldSend: false,
      reason: 'Deduplication service error',
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

async function checkDeduplication(
  supabase: any,
  params: {
    bookingId: string;
    workerEmail: string;
    emailType: string;
    force: boolean;
    source: string;
  }
): Promise<DeduplicationResult> {
  const { bookingId, workerEmail, emailType, force, source } = params;

  // Rule 1: If force=true, always allow (but log it)
  if (force) {
    console.log('Force send enabled - bypassing deduplication');
    await logDeduplicationEvent(supabase, {
      bookingId,
      workerEmail,
      emailType,
      action: 'force_allowed',
      source,
      reason: 'Force flag enabled'
    });
    
    return {
      shouldSend: true,
      reason: 'Force send enabled'
    };
  }

  // Rule 2: Check for existing successful emails
  const { data: existingEmails, error } = await supabase
    .from('email_logs')
    .select('id, sent_at, created_at, status')
    .eq('booking_id', bookingId)
    .eq('recipient_email', workerEmail)
    .eq('email_type', emailType)
    .eq('status', 'sent')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error checking existing emails:', error);
    // On database error, allow send but log the issue
    return {
      shouldSend: true,
      reason: 'Database error - allowing send'
    };
  }

  if (existingEmails && existingEmails.length > 0) {
    const latestEmail = existingEmails[0];
    console.log('Found existing successful email:', latestEmail);
    
    await logDeduplicationEvent(supabase, {
      bookingId,
      workerEmail,
      emailType,
      action: 'blocked_duplicate',
      source,
      reason: `Email already sent successfully at ${latestEmail.sent_at || latestEmail.created_at}`,
      existingEmailId: latestEmail.id
    });

    return {
      shouldSend: false,
      reason: 'Email already sent successfully',
      existingEmailId: latestEmail.id
    };
  }

  // Rule 3: Check for recent failed attempts (cooldown period)
  const cooldownMinutes = 5; // Wait 5 minutes before retry after failure (reduced from 15)
  const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const { data: recentFailures } = await supabase
    .from('email_logs')
    .select('id, created_at, status')
    .eq('booking_id', bookingId)
    .eq('recipient_email', workerEmail)
    .eq('email_type', emailType)
    .eq('status', 'failed')
    .gte('created_at', cooldownTime.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (recentFailures && recentFailures.length > 0) {
    const cooldownUntil = new Date(new Date(recentFailures[0].created_at).getTime() + cooldownMinutes * 60 * 1000);
    
    console.log('Recent failure found, in cooldown period until:', cooldownUntil);
    
    await logDeduplicationEvent(supabase, {
      bookingId,
      workerEmail,
      emailType,
      action: 'blocked_cooldown',
      source,
      reason: `Recent failure - in cooldown until ${cooldownUntil.toISOString()}`,
      existingEmailId: recentFailures[0].id
    });

    return {
      shouldSend: false,
      reason: 'In cooldown period after recent failure',
      cooldownUntil: cooldownUntil.toISOString()
    };
  }

  // Rule 4: Check for rate limiting (max 3 attempts per booking+worker+email_type)
  const { data: allAttempts } = await supabase
    .from('email_logs')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('recipient_email', workerEmail)
    .eq('email_type', emailType);

  if (allAttempts && allAttempts.length >= 3) {
    console.log('Rate limit exceeded: 3 attempts already made');
    
    await logDeduplicationEvent(supabase, {
      bookingId,
      workerEmail,
      emailType,
      action: 'blocked_rate_limit',
      source,
      reason: `Rate limit exceeded: ${allAttempts.length} attempts already made`
    });

    return {
      shouldSend: false,
      reason: 'Rate limit exceeded (max 3 attempts)'
    };
  }

  // All checks passed - allow sending
  await logDeduplicationEvent(supabase, {
    bookingId,
    workerEmail,
    emailType,
    action: 'allowed',
    source,
    reason: 'All deduplication checks passed'
  });

  return {
    shouldSend: true,
    reason: 'All deduplication checks passed'
  };
}

async function logDeduplicationEvent(
  supabase: any,
  params: {
    bookingId: string;
    workerEmail: string;
    emailType: string;
    action: string;
    source: string;
    reason: string;
    existingEmailId?: string;
  }
) {
  try {
    await supabase.from('sms_logs').insert({
      booking_id: params.bookingId,
      recipient_number: 'deduplication',
      message: `Email ${params.action}: ${params.emailType} for ${params.workerEmail} from ${params.source} - ${params.reason}`,
      status: 'sent',
      error_message: params.existingEmailId || null
    });
  } catch (error) {
    console.error('Failed to log deduplication event:', error);
  }
}

serve(handler);