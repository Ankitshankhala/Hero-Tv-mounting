import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmartEmailRequest {
  bookingId: string;
  workerId?: string;
  emailType: 'worker_assignment' | 'customer_confirmation';
  source: 'trigger' | 'manual' | 'retry' | 'system';
  force?: boolean;
}

/**
 * Smart Email Dispatcher - Central orchestrator for all email sending
 * Ensures deduplication and proper routing of email notifications
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SMART EMAIL DISPATCHER ===');
    
    const { bookingId, workerId, emailType, source, force = false }: SmartEmailRequest = await req.json();
    console.log('Email dispatch request:', { bookingId, workerId, emailType, source, force });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result;

    if (emailType === 'worker_assignment') {
      result = await handleWorkerAssignmentEmail(supabase, { bookingId, workerId, source, force });
    } else if (emailType === 'customer_confirmation') {
      result = await handleCustomerConfirmationEmail(supabase, { bookingId, source, force });
    } else {
      throw new Error(`Unsupported email type: ${emailType}`);
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Smart email dispatcher error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

async function handleWorkerAssignmentEmail(
  supabase: any,
  params: { bookingId: string; workerId?: string; source: string; force: boolean }
) {
  const { bookingId, source, force } = params;
  let { workerId } = params;

  // If workerId not provided, get it from booking
  if (!workerId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('worker_id')
      .eq('id', bookingId)
      .maybeSingle();
    
    if (!booking?.worker_id) {
      return {
        success: false,
        error: 'No worker assigned to booking',
        cached: false
      };
    }
    workerId = booking.worker_id;
  }

  // Check deduplication
  const { data: dedupResult, error: dedupError } = await supabase.functions.invoke(
    'email-deduplication-service',
    {
      body: {
        bookingId,
        workerId,
        emailType: 'worker_assignment',
        force,
        source
      }
    }
  );

  if (dedupError) {
    console.error('Deduplication service error:', dedupError);
    // Continue with send if deduplication service fails
  } else if (dedupResult && !dedupResult.shouldSend) {
    console.log('Email blocked by deduplication:', dedupResult.reason);
    return {
      success: true,
      cached: true,
      reason: dedupResult.reason,
      source: 'deduplication_service'
    };
  }

  // Send email via existing function
  const { data: emailResult, error: emailError } = await supabase.functions.invoke(
    'send-worker-assignment-notification',
    {
      body: {
        bookingId,
        workerId,
        force: true // Force since we already checked deduplication
      }
    }
  );

  if (emailError) {
    console.error('Worker email send failed:', emailError);
    return {
      success: false,
      error: emailError.message,
      source: 'worker_assignment_function'
    };
  }

  console.log('Worker assignment email sent successfully');
  return {
    success: true,
    cached: false,
    emailId: emailResult?.emailId,
    source: 'worker_assignment_function'
  };
}

async function handleCustomerConfirmationEmail(
  supabase: any,
  params: { bookingId: string; source: string; force: boolean }
) {
  const { bookingId, source, force } = params;

  // Customer emails don't need worker-specific deduplication
  // But we still check for existing successful sends
  if (!force) {
    const { data: existingEmail } = await supabase
      .from('email_logs')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('email_type', 'customer_confirmation')
      .eq('status', 'sent')
      .maybeSingle();

    if (existingEmail) {
      console.log('Customer confirmation email already sent');
      return {
        success: true,
        cached: true,
        reason: 'Customer email already sent',
        existingEmailId: existingEmail.id
      };
    }
  }

  // Send email via existing function
  const { data: emailResult, error: emailError } = await supabase.functions.invoke(
    'send-customer-booking-confirmation-email',
    {
      body: { bookingId }
    }
  );

  if (emailError) {
    console.error('Customer email send failed:', emailError);
    return {
      success: false,
      error: emailError.message,
      source: 'customer_confirmation_function'
    };
  }

  console.log('Customer confirmation email sent successfully');
  return {
    success: true,
    cached: false,
    source: 'customer_confirmation_function'
  };
}

serve(handler);