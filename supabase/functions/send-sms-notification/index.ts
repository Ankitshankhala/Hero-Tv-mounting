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

    const { bookingId } = await req.json();
    
    if (!bookingId) {
      throw new Error('bookingId is required');
    }

    console.log(`[SMS-NOTIFICATION] Processing SMS for booking ${bookingId}`);

    // Fetch booking details with worker and customer info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_date,
        scheduled_start,
        worker_id,
        customer_id,
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

    console.log(`[SMS-NOTIFICATION] Booking data loaded:`, {
      hasWorker: !!booking.worker,
      hasCustomer: !!booking.customer,
      hasGuest: !!booking.guest_customer_info
    });

    // Determine recipient and message
    let recipientPhone: string | null = null;
    let message = '';
    let recipientName = '';

    if (booking.worker?.phone) {
      // Send to worker
      recipientPhone = booking.worker.phone;
      recipientName = booking.worker.name || 'Worker';
      
      const customerName = booking.customer?.name || 
                          booking.guest_customer_info?.name || 
                          'Customer';
      
      message = `Hi ${recipientName}! You've been assigned to a new booking on ${booking.scheduled_date} at ${booking.scheduled_start}. Customer: ${customerName}. Please log in to view details.`;
    } else {
      throw new Error('Worker phone number not found');
    }

    if (!recipientPhone) {
      throw new Error('No valid recipient phone number found');
    }

    console.log(`[SMS-NOTIFICATION] Sending SMS to ${recipientPhone}`);

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

    // Log to sms_logs table
    await supabase.from('sms_logs').insert({
      booking_id: bookingId,
      recipient_number: recipientPhone,
      recipient_name: recipientName,
      message: message,
      status: 'sent',
      twilio_sid: twilioResult.sid,
      sent_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sid: twilioResult.sid,
        message: 'SMS sent successfully',
        recipient: recipientPhone
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
      const { bookingId } = await req.json();
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
          error_message: errorMessage
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