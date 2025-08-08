
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

    // Get booking details with worker info (supports both guest and authenticated users)
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        id,
        scheduled_date,
        scheduled_start,
        location_notes,
        worker_id,
        guest_customer_info,
        customer_id,
        worker:users!worker_id (
          name, 
          phone
        ),
        customer:users!customer_id (
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
    if (!booking.worker_id || !booking.worker?.phone) {
      return new Response(
        JSON.stringify({ error: 'No worker assigned or worker has no phone' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Idempotency guard: prevent duplicate worker SMS within TTL
    const idempotencyKey = `worker_sms_${booking.id}_${booking.worker_id}`;
    const requestHash = btoa(JSON.stringify({ bookingId, workerId: booking.worker_id, phone: booking.worker.phone }));
    let idempotencyRecordId: string | null = null;
    try {
      const { data: existing } = await supabaseClient
        .from('idempotency_records')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .eq('operation_type', 'worker_sms')
        .single();

      if (existing) {
        const expired = new Date(existing.expires_at) < new Date();
        if (!expired) {
          if (existing.request_hash !== requestHash) {
            return new Response(JSON.stringify({ error: 'Idempotency key reused with different request' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (existing.status === 'completed') {
            return new Response(JSON.stringify(existing.response_data || { success: true, cached: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            });
          }
          if (existing.status === 'pending') {
            return new Response(JSON.stringify({ error: 'Operation in progress' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 409,
            });
          }
        } else {
          await supabaseClient.from('idempotency_records').delete().eq('id', existing.id);
        }
      }

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { data: created, error: idemInsertErr } = await supabaseClient
        .from('idempotency_records')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'worker_sms',
          request_hash: requestHash,
          user_id: booking.worker_id,
          status: 'pending',
          expires_at: expiresAt,
          response_data: null,
        })
        .select('id')
        .single();
      if (idemInsertErr) throw idemInsertErr;
      idempotencyRecordId = created.id;
    } catch (idErr) {
      console.warn('Idempotency pre-check error (continuing):', idErr);
    }

    // Get booking services
    const { data: bookingServices } = await supabaseClient
      .from('booking_services')
      .select('service_name, quantity')
      .eq('booking_id', bookingId);

    // Format scheduled date and time
    const scheduledDate = new Date(`${booking.scheduled_date}T${booking.scheduled_start}`);
    const formattedDate = scheduledDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Get customer info (handle both guest and authenticated users)
    const guestInfo = booking.guest_customer_info || {};
    const customerInfo = booking.customer || guestInfo;
    const customerName = customerInfo.name || guestInfo.name || 'Customer';
    const customerAddress = guestInfo.address || 'Address in booking';
    const customerPhone = customerInfo.phone || guestInfo.phone || 'Phone in booking';

    // Format services
    const services = bookingServices?.map(s => `${s.service_name} x${s.quantity}`).join(', ') || 'Service details in booking';
    
    // Compose structured message
    const messageBody = `🔧 NEW JOB ASSIGNMENT

Worker: ${booking.worker?.name || 'Worker'}

Service: ${services}
Date: ${formattedDate}, ${formattedTime}

Customer: ${customerName}
Address: ${customerAddress}
Phone: ${customerPhone}

${booking.location_notes ? `Notes: ${booking.location_notes}` : ''}

Reply Y to confirm or N if unavailable.`.trim();

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
          recipient_number: booking.worker.phone,
          recipient_name: booking.worker.name,
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

      // Update idempotency on success
      if (idempotencyRecordId) {
        await supabaseClient
          .from('idempotency_records')
          .update({ status: 'completed', response_data: { success: true, mock: true, sms: smsLog } })
          .eq('id', idempotencyRecordId);
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
        To: booking.worker.phone,
        Body: messageBody,
      }),
    });

    const twilioData = await twilioResponse.json();
    
    if (!twilioResponse.ok) {
      // Log failed SMS
      await supabaseClient.from('sms_logs').insert({
        booking_id: bookingId,
        recipient_number: booking.worker.phone,
        recipient_name: booking.worker.name,
        message: messageBody,
        status: 'failed',
        error_message: JSON.stringify(twilioData),
      });

      // Mark idempotency as failed
      try {
        await supabaseClient
          .from('idempotency_records')
          .update({ status: 'failed', response_data: { error: twilioData } })
          .eq('id', idempotencyRecordId || '')
          .eq('operation_type', 'worker_sms');
      } catch (_) {}
      
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
        recipient_number: booking.worker.phone,
        recipient_name: booking.worker.name,
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
