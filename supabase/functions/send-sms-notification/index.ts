import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Formats phone number to E.164 standard (required by Twilio)
 * E.164 format: +[country code][subscriber number]
 * Example: +12025551234
 */
function formatPhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle empty or invalid phone numbers
  if (digitsOnly.length < 10) {
    console.warn(`[SMS-E164] Invalid phone length: ${digitsOnly.length}`);
    return null;
  }
  
  // Handle 10-digit US numbers (add +1 prefix)
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  
  // Handle 11-digit numbers starting with 1 (US numbers)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }
  
  // For other formats, add + prefix if not present
  const formatted = digitsOnly.startsWith('+') ? phone : `+${digitsOnly}`;
  console.log(`[SMS-E164] Formatted ${phone} -> ${formatted}`);
  return formatted;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, force = false, smsType = 'worker_assignment' } = await req.json();
    
    if (!bookingId) {
      throw new Error('bookingId is required');
    }

    console.log(`[SMS-NOTIFICATION] Processing SMS for booking ${bookingId}, force=${force}, type=${smsType}`);

    // Fetch booking details with worker and customer info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_date,
        scheduled_start,
        worker_id,
        customer_id,
        worker_sms_sent,
        worker:worker_id (
          id,
          name,
          phone
        ),
        customer:customer_id (
          id,
          name,
          phone
        ),
        guest_customer_info
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    // IDEMPOTENCY CHECK: Skip if SMS already sent (unless force=true)
    if (smsType === 'worker_assignment' && booking.worker_sms_sent && !force) {
      console.log(`[SMS-NOTIFICATION] Worker SMS already sent for booking ${bookingId}, skipping (idempotent)`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: 'worker_sms_already_sent',
          message: 'SMS already sent for this booking'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Check for existing successful SMS log entry as secondary idempotency check
    if (!force) {
      const { data: existingSms } = await supabase
        .from('sms_logs')
        .select('id, twilio_sid')
        .eq('booking_id', bookingId)
        .eq('status', 'sent')
        .eq('sms_type', smsType)
        .not('twilio_sid', 'is', null)
        .limit(1);

      if (existingSms && existingSms.length > 0) {
        console.log(`[SMS-NOTIFICATION] Found existing SMS log for booking ${bookingId}, updating flag and skipping`);
        
        // Update the booking flag if it wasn't set
        if (!booking.worker_sms_sent && smsType === 'worker_assignment') {
          await supabase
            .from('bookings')
            .update({ worker_sms_sent: true })
            .eq('id', bookingId);
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true,
            reason: 'sms_log_exists',
            message: 'SMS log already exists for this booking'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
    }

    console.log(`[SMS-NOTIFICATION] Booking data loaded:`, {
      hasWorker: !!booking.worker,
      hasCustomer: !!booking.customer,
      hasGuest: !!booking.guest_customer_info,
      workerSmsSent: booking.worker_sms_sent
    });

    // Determine recipient and message
    let recipientPhone: string | null = null;
    let message = '';
    let recipientName = '';

    if (booking.worker?.phone) {
      // Send to worker
      recipientPhone = formatPhoneE164(booking.worker.phone);
      recipientName = booking.worker.name || 'Worker';
      
      const customerName = booking.customer?.name || 
                          booking.guest_customer_info?.name || 
                          'Customer';
      
      message = `Hi ${recipientName}! You've been assigned to a new booking on ${booking.scheduled_date} at ${booking.scheduled_start}. Customer: ${customerName}. Please log in to view details.`;
    } else {
      throw new Error('Worker phone number not found');
    }

    if (!recipientPhone) {
      throw new Error('No valid recipient phone number found or invalid phone format');
    }

    console.log(`[SMS-NOTIFICATION] Sending SMS to ${recipientPhone} (E.164 format)`);

    // Validate Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Missing Twilio credentials - check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER');
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: recipientPhone,
        From: fromNumber,
        Body: message,
      }),
    });

    const twilioResult = await response.json();

    if (!response.ok) {
      console.error(`[SMS-NOTIFICATION] Twilio API error:`, twilioResult);
      throw new Error(`Twilio API error: ${twilioResult.message || JSON.stringify(twilioResult)}`);
    }

    console.log(`[SMS-NOTIFICATION] SMS sent successfully - SID: ${twilioResult.sid}`);

    // Log to sms_logs table with sms_type
    await supabase.from('sms_logs').insert({
      booking_id: bookingId,
      recipient_number: recipientPhone,
      recipient_name: recipientName,
      message: message,
      status: 'sent',
      twilio_sid: twilioResult.sid,
      sent_at: new Date().toISOString(),
      sms_type: smsType
    });

    // Update booking flag to prevent duplicate sends
    if (smsType === 'worker_assignment') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ worker_sms_sent: true })
        .eq('id', bookingId);
      
      if (updateError) {
        console.warn(`[SMS-NOTIFICATION] Failed to update worker_sms_sent flag: ${updateError.message}`);
      } else {
        console.log(`[SMS-NOTIFICATION] Updated worker_sms_sent=true for booking ${bookingId}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sid: twilioResult.sid,
        message: 'SMS sent successfully',
        recipient: recipientPhone,
        smsType: smsType
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SMS-NOTIFICATION] Error:`, errorMessage);
    
    // Try to log error to database
    try {
      const body = await req.clone().json().catch(() => ({}));
      const bookingId = body.bookingId;
      const smsType = body.smsType || 'worker_assignment';
      
      if (bookingId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabase.from('sms_logs').insert({
          booking_id: bookingId,
          recipient_number: 'error',
          message: 'SMS send failed',
          status: 'failed',
          error_message: errorMessage,
          sms_type: smsType
        });
      }
    } catch (logError) {
      console.error(`[SMS-NOTIFICATION] Failed to log error:`, logError);
    }
    
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
