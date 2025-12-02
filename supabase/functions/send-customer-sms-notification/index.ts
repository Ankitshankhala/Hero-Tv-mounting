import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-SMS] ${step}${detailsStr}`);
};

/**
 * Format phone number to E.164 format for Twilio
 */
function formatPhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.length < 10) return null;
  
  // Handle 10-digit US numbers (add +1 prefix)
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  
  // Handle 11-digit numbers starting with 1 (US numbers)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }
  
  // For other formats, return with + prefix
  return `+${digitsOnly}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function start');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { bookingId, force = false, smsType = 'customer_confirmation' } = body;

    if (!bookingId) {
      logStep('Missing bookingId');
      return new Response(
        JSON.stringify({ success: false, error: 'bookingId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Processing customer SMS', { bookingId, force, smsType });

    // Fetch booking with customer info and worker info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_id,
        guest_customer_info,
        customer_sms_sent,
        scheduled_date,
        scheduled_start,
        local_service_date,
        local_service_time,
        worker_id,
        customer:users!bookings_customer_id_fkey(name, email, phone),
        worker:users!bookings_worker_id_fkey(name, phone)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      logStep('Booking not found', { error: bookingError?.message });
      return new Response(
        JSON.stringify({ success: false, error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency Check 1: Check booking flag
    if (!force && booking.customer_sms_sent) {
      logStep('Idempotency: customer_sms_sent flag already true', { bookingId });
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'Customer SMS already sent (flag check)' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency Check 2: Check sms_logs for existing successful send
    if (!force) {
      const { data: existingLogs } = await supabase
        .from('sms_logs')
        .select('id, status, twilio_sid')
        .eq('booking_id', bookingId)
        .eq('sms_type', 'customer_confirmation')
        .eq('status', 'sent')
        .not('twilio_sid', 'is', null)
        .limit(1);

      if (existingLogs && existingLogs.length > 0) {
        logStep('Idempotency: Found existing successful customer SMS', { 
          bookingId,
          existingLogId: existingLogs[0].id 
        });
        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true, 
            reason: 'Customer SMS already sent (log check)' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get customer info (registered or guest)
    const customerInfo = booking.customer_id
      ? {
          name: (booking.customer as any)?.name || 'Customer',
          phone: (booking.customer as any)?.phone,
          email: (booking.customer as any)?.email
        }
      : {
          name: booking.guest_customer_info?.name || 'Customer',
          phone: booking.guest_customer_info?.phone,
          email: booking.guest_customer_info?.email
        };

    // Format phone number
    const formattedPhone = formatPhoneE164(customerInfo.phone);
    
    if (!formattedPhone) {
      logStep('Customer phone invalid or missing', { 
        bookingId, 
        rawPhone: customerInfo.phone 
      });
      
      // Log the failure
      await supabase.from('sms_logs').insert({
        booking_id: bookingId,
        recipient_number: customerInfo.phone || 'unknown',
        recipient_name: customerInfo.name,
        message: 'Customer phone number invalid or missing',
        status: 'failed',
        sms_type: smsType,
        error_message: 'Invalid phone number format'
      });

      return new Response(
        JSON.stringify({ success: false, error: 'Customer phone number invalid or missing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get worker name
    const workerName = booking.worker_id 
      ? (booking.worker as any)?.name || 'your technician'
      : 'your technician';

    // Format date and time for message
    const serviceDate = booking.local_service_date || booking.scheduled_date;
    const serviceTime = booking.local_service_time || booking.scheduled_start;
    
    let formattedDate = serviceDate;
    let formattedTime = serviceTime;
    
    try {
      if (serviceDate) {
        const dateObj = new Date(serviceDate + 'T00:00:00');
        formattedDate = dateObj.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
      }
      if (serviceTime) {
        const [hours, minutes] = serviceTime.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        formattedTime = `${hour12}:${minutes} ${ampm}`;
      }
    } catch (e) {
      logStep('Date/time formatting error, using raw values', { error: e });
    }

    // Build SMS message
    const smsMessage = `Hi ${customerInfo.name}! Your Hero TV Mounting appointment is confirmed for ${formattedDate} at ${formattedTime}. Your technician is ${workerName}. Questions? Reply to this text or visit herotvmounting.com`;

    logStep('Sending customer SMS', { 
      bookingId, 
      phone: formattedPhone,
      messageLength: smsMessage.length 
    });

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      logStep('Twilio credentials missing');
      
      await supabase.from('sms_logs').insert({
        booking_id: bookingId,
        recipient_number: formattedPhone,
        recipient_name: customerInfo.name,
        message: smsMessage,
        status: 'failed',
        sms_type: smsType,
        error_message: 'Twilio credentials not configured'
      });

      return new Response(
        JSON.stringify({ success: false, error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: twilioPhoneNumber,
        Body: smsMessage,
      }),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      logStep('Twilio API error', { 
        status: twilioResponse.status, 
        error: twilioData 
      });

      await supabase.from('sms_logs').insert({
        booking_id: bookingId,
        recipient_number: formattedPhone,
        recipient_name: customerInfo.name,
        message: smsMessage,
        status: 'failed',
        sms_type: smsType,
        error_message: twilioData.message || 'Twilio API error'
      });

      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send SMS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('SMS sent successfully', { 
      twilioSid: twilioData.sid,
      bookingId 
    });

    // Log successful SMS
    await supabase.from('sms_logs').insert({
      booking_id: bookingId,
      recipient_number: formattedPhone,
      recipient_name: customerInfo.name,
      message: smsMessage,
      status: 'sent',
      sms_type: smsType,
      twilio_sid: twilioData.sid,
      sent_at: new Date().toISOString()
    });

    // Update booking flag
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ customer_sms_sent: true })
      .eq('id', bookingId);

    if (updateError) {
      logStep('Failed to update customer_sms_sent flag', { error: updateError.message });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        twilioSid: twilioData.sid,
        recipient: formattedPhone 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
