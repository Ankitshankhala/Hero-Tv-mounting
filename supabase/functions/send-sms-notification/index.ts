
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'Booking ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get booking details with worker info (guest-only architecture)
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        id,
        scheduled_date,
        scheduled_start,
        location_notes,
        worker_id,
        guest_customer_info,
        users:worker_id (
          name, 
          phone
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: bookingError?.message || 'Booking not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Make sure we have a worker assigned
    if (!booking.worker_id || !booking.users?.phone) {
      return new Response(
        JSON.stringify({ error: 'No worker assigned or worker has no phone' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Format scheduled date and time
    const scheduledDate = new Date(`${booking.scheduled_date}T${booking.scheduled_start}`);
    const formattedDate = scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    // Get customer name from guest info
    const customerName = booking.guest_customer_info?.name || 'Unknown Customer';
    
    // Compose message
    const messageBody = `
      New job assigned! ${formattedDate} at ${formattedTime}
      Customer: ${customerName}
      Address: ${booking.location_notes || 'Address details in booking'}
      Reply Y to confirm or N if unavailable.
    `.replace(/\s+/g, ' ').trim();

    // Get Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhone) {
      // Mock SMS for development if no Twilio credentials
      console.log('Twilio credentials not found, mocking SMS');
      
      // Log SMS in database with mocked status
      const { data: smsLog, error: smsError } = await supabaseClient
        .from('sms_logs')
        .insert({
          booking_id: bookingId,
          recipient_number: booking.users.phone,
          recipient_name: booking.users.name,
          message: messageBody,
          twilio_sid: 'MOCK_SID',
          status: 'sent'
        })
        .select()
        .single();
      
      if (smsError) {
        return new Response(
          JSON.stringify({ error: smsError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, mock: true, sms: smsLog }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioAuth = btoa(`${accountSid}:${authToken}`);
    
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromPhone,
        To: booking.users.phone,
        Body: messageBody,
      }),
    });

    const twilioData = await twilioResponse.json();
    
    if (!twilioResponse.ok) {
      // Log failed SMS
      await supabaseClient.from('sms_logs').insert({
        booking_id: bookingId,
        recipient_number: booking.users.phone,
        recipient_name: booking.users.name,
        message: messageBody,
        status: 'failed',
        error_message: JSON.stringify(twilioData),
      });
      
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', twilio_error: twilioData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Log successful SMS
    const { data: smsLog } = await supabaseClient
      .from('sms_logs')
      .insert({
        booking_id: bookingId,
        recipient_number: booking.users.phone,
        recipient_name: booking.users.name,
        message: messageBody,
        twilio_sid: twilioData.sid,
        status: 'sent',
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({ success: true, sms: smsLog, twilio: twilioData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
