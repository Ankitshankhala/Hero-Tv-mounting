import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WatchdogRequest {
  bookingId: string;
  workerId: string;
  originalError: string;
  errorType: 'timeout' | 'hard_bounce' | 'server_error' | 'smtp_error';
  retryAttempt?: number;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[EMAIL-WATCHDOG] ${step}`, details ? `- ${JSON.stringify(details)}` : '');
};

const isTransientError = (errorType: string): boolean => {
  return ['timeout', 'server_error', 'smtp_error'].includes(errorType);
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, workerId, originalError, errorType, retryAttempt = 0 }: WatchdogRequest = await req.json();

    logStep('Processing email failure watchdog', { 
      bookingId, 
      workerId, 
      errorType, 
      retryAttempt,
      originalError: originalError.substring(0, 100) + '...'
    });

    // Immediate retry (attempt 1)
    if (retryAttempt === 0) {
      logStep('Attempting immediate retry');
      
      try {
        const retryResponse = await supabase.functions.invoke('send-worker-assignment-notification', {
          body: { bookingId, workerId }
        });

        if (!retryResponse.error) {
          logStep('Immediate retry succeeded');
          
          // Log successful retry
          await supabase.from('email_logs').insert({
            booking_id: bookingId,
            recipient_email: 'system',
            subject: 'Watchdog: Email retry successful',
            message: `Original error: ${originalError}`,
            status: 'sent',
            email_type: 'worker_assignment_retry'
          });

          return new Response(JSON.stringify({ 
            success: true, 
            action: 'retry_succeeded' 
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } catch (retryError) {
        logStep('Immediate retry failed', { error: retryError });
      }
    }

    // Schedule delayed retry for transient errors (attempt 2)
    if (retryAttempt <= 1 && isTransientError(errorType)) {
      logStep('Scheduling delayed retry for transient error');
      
      // Schedule retry in 60 seconds using a delayed function call
      setTimeout(async () => {
        try {
          await supabase.functions.invoke('email-failure-watchdog', {
            body: { 
              bookingId, 
              workerId, 
              originalError, 
              errorType, 
              retryAttempt: retryAttempt + 1 
            }
          });
        } catch (error) {
          logStep('Failed to schedule delayed retry', { error });
        }
      }, 60000); // 60 seconds

      return new Response(JSON.stringify({ 
        success: true, 
        action: 'scheduled_retry' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Final escalation: Send SMS to worker and admin
    logStep('Escalating to SMS notifications');

    // Get worker phone and email
    const { data: workerData } = await supabase
      .from('users')
      .select('phone, email, name')
      .eq('id', workerId)
      .single();

    if (!workerData) {
      throw new Error('Worker not found');
    }

    // Get booking details for context
    const { data: bookingData } = await supabase
      .from('bookings')
      .select(`
        *,
        booking_services (service_name),
        users!bookings_customer_id_fkey (name, email)
      `)
      .eq('id', bookingId)
      .single();

    if (!bookingData) {
      throw new Error('Booking not found');
    }

    let smsCount = 0;

    // Send SMS to worker if phone available
    if (workerData.phone) {
      try {
        await supabase.functions.invoke('send-sms-notification', {
          body: { 
            bookingId,
            message: `URGENT: New job assignment! Email failed to deliver. Check your email for details or call support. Job #${bookingId.substring(0, 8)}`,
            recipientPhone: workerData.phone
          }
        });
        smsCount++;
        logStep('SMS sent to worker');
      } catch (smsError) {
        logStep('Failed to send SMS to worker', { error: smsError });
      }
    }

    // Send SMS to admin (assuming system admin number)
    try {
      await supabase.from('sms_logs').insert({
        booking_id: bookingId,
        recipient_number: 'admin',
        message: `ALERT: Worker email failed for booking ${bookingId}. Worker: ${workerData.name} (${workerData.email}). Error: ${errorType}`,
        status: 'sent'
      });
      smsCount++;
      logStep('Admin notification logged');
    } catch (adminError) {
      logStep('Failed to log admin notification', { error: adminError });
    }

    // Log the escalation
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: workerData.email,
      subject: 'Watchdog: Email failure escalated',
      message: `Original error: ${originalError}. Escalated to SMS (${smsCount} sent).`,
      status: 'failed',
      email_type: 'worker_assignment_escalation'
    });

    // If it's a hard bounce or persistent error, mark for manual review
    if (errorType === 'hard_bounce' || retryAttempt >= 2) {
      logStep('Marking assignment for manual review');
      
      await supabase.from('worker_bookings')
        .update({ 
          ack_status: 'expired',
          ack_deadline: new Date() // Mark as expired immediately
        })
        .eq('booking_id', bookingId)
        .eq('worker_id', workerId);

      // Auto-reassign the job
      try {
        await supabase.rpc('auto_assign_workers_with_coverage', { 
          p_booking_id: bookingId 
        });
        logStep('Job reassignment triggered');
      } catch (reassignError) {
        logStep('Failed to trigger reassignment', { error: reassignError });
      }
    }

    logStep('Watchdog processing completed', { 
      smsCount, 
      action: retryAttempt >= 2 ? 'reassigned' : 'escalated' 
    });

    return new Response(JSON.stringify({ 
      success: true, 
      action: 'escalated',
      smsCount,
      reassigned: retryAttempt >= 2
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    logStep('Watchdog error', { error: error.message });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

serve(handler);