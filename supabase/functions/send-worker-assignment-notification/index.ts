
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkerAssignmentRequest {
  bookingId: string;
  workerId: string;
  force?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Worker assignment notification START ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const { bookingId, workerId, force = false }: WorkerAssignmentRequest = await req.json();
    console.log('Request payload:', { bookingId, workerId, force });
    
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM') || 'Hero TV Mounting <onboarding@resend.dev>';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      throw new Error('Missing Supabase configuration');
    }
    
    if (!resendKey) {
      console.error('RESEND_API_KEY not found. Available env vars:', Object.keys(Deno.env.toObject()));
      throw new Error('Missing RESEND_API_KEY - email sending not configured');
    }
    
    console.log('RESEND_API_KEY found, length:', resendKey.length, 'starts with:', resendKey.substring(0, 5));
    console.log('Environment validation passed');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Idempotency lock to prevent duplicate sends in race conditions
    const idempotencyKey = `worker_assignment:${bookingId}:${workerId}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes TTL
    let idempotencyRecordId: string | null = null;

    // Try to create an idempotency record. If it already exists, treat as cached/in-progress
    try {
      const { data: idemInsert } = await supabase
        .from('idempotency_records')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'email_send_worker_assignment',
          request_hash: btoa(JSON.stringify({ bookingId, workerId })),
          user_id: workerId,
          status: 'pending',
          expires_at: expiresAt
        })
        .select('id')
        .single();

      idempotencyRecordId = idemInsert?.id ?? null;
      console.log('Idempotency record created:', { idempotencyRecordId });
    } catch (idemErr) {
      console.log('Idempotency insert error (likely duplicate/in-flight):', idemErr);
      const { data: existing } = await supabase
        .from('idempotency_records')
        .select('id, status, response_data')
        .eq('idempotency_key', idempotencyKey)
        .eq('operation_type', 'email_send_worker_assignment')
        .maybeSingle();

      if (existing?.status === 'completed') {
        return new Response(JSON.stringify({
          success: true,
          cached: true,
          reason: 'Already sent (idempotent)'
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      return new Response(JSON.stringify({
        success: true,
        cached: true,
        reason: 'Send already in progress (idempotent lock)'
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Use centralized deduplication service (secondary guard)
    console.log('Checking email deduplication...');
    const { data: deduplicationResult, error: dedupError } = await supabase.functions.invoke(
      'email-deduplication-service',
      {
        body: {
          bookingId,
          workerId,
          emailType: 'worker_assignment',
          force,
          source: 'direct_call'
        }
      }
    );

    if (dedupError) {
      console.error('Deduplication service error:', dedupError);
      // Continue with send if deduplication service fails
    } else if (deduplicationResult && !deduplicationResult.shouldSend) {
      console.log('Deduplication service blocked email:', deduplicationResult.reason);
      return new Response(JSON.stringify({ 
        success: true, 
        cached: true, 
        reason: deduplicationResult.reason,
        existingEmailId: deduplicationResult.existingEmailId
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    console.log('Deduplication check passed, proceeding with email send');

    // Get comprehensive booking, worker, and service details with separate queries
    console.log('Fetching booking and worker data...');
    const [{ data: booking, error: bookingError }, { data: worker, error: workerError }] = await Promise.all([
      supabase.from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle(),
      supabase.from('users').select('name, email, phone').eq('id', workerId).maybeSingle()
    ]);

    console.log('Booking query result:', { booking, bookingError });
    console.log('Worker query result:', { worker, workerError });

    if (bookingError) {
      console.error('Error fetching booking:', bookingError);
      throw new Error(`Failed to fetch booking: ${bookingError.message}`);
    }

    if (workerError) {
      console.error('Error fetching worker:', workerError);
      throw new Error(`Failed to fetch worker: ${workerError.message}`);
    }

    if (!booking) {
      console.error('Booking not found');
      throw new Error('Booking not found');
    }

    if (!worker?.email) {
      console.error('Worker not found or missing email:', { 
        workerFound: !!worker, 
        workerEmail: worker?.email 
      });
      throw new Error('Worker not found or missing email address');
    }

    // Get booking services separately to avoid join issues
    console.log('Fetching booking services...');
    const { data: bookingServices, error: servicesError } = await supabase
      .from('booking_services')
      .select('id, service_name, quantity, base_price')
      .eq('booking_id', bookingId);

    if (servicesError) {
      console.error('Error fetching booking services:', servicesError);
      // Don't fail completely - continue with empty services
      console.log('Continuing without services data');
    }
    
    console.log('Data fetched successfully:', {
      bookingId: booking.id,
      workerName: worker.name,
      workerEmail: worker.email,
      servicesCount: bookingServices?.length || 0
    });

    // Format date and time
    const formatDate = (date: string) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    // Get customer info (handle both registered users and guests)
    let customerInfo;
    if (booking.customer_id) {
      const { data: customer } = await supabase
        .from('users')
        .select('name, email, phone, city, zip_code')
        .eq('id', booking.customer_id)
        .maybeSingle();
      customerInfo = customer;
    } else {
      customerInfo = booking.guest_customer_info;
    }

    // Build services list from separate query
    const servicesList = bookingServices && bookingServices.length > 0
      ? bookingServices.map((service: any) => `${service.service_name} x${service.quantity}`).join('<br>')
      : 'Service details not available';

    // Extract special instructions and address from location_notes or guest info
    const specialInstructions = booking.location_notes || 'None specified';
    const address = customerInfo?.address || (booking.guest_customer_info?.address || 'Address not provided');
    const city = customerInfo?.city || (booking.guest_customer_info?.city || '');
    const zipCode = customerInfo?.zip_code || (booking.guest_customer_info?.zipcode || '');
    
    // Extract unit and apartment info
    const unit = customerInfo?.unit || booking.guest_customer_info?.unit || '';
    const apartmentName = customerInfo?.apartment_name || booking.guest_customer_info?.apartment_name || '';

    console.log('Preparing email with Resend API...');
    console.log('Recipient:', worker.email);
    
    const resend = new Resend(resendKey);
    
    const emailSubject = `NEW JOB ASSIGNMENT - ${formatDate(booking.scheduled_date)}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Job Assignment</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 24px;">NEW JOB ASSIGNMENT</h1>
          <h2 style="color: #e74c3c; margin: 0; font-size: 20px;">Hero TV Mounting</h2>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Worker:</h3>
          <p style="margin: 0; font-size: 18px; font-weight: bold;">${worker.name}</p>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Service:</h3>
          <p style="margin: 0;">${servicesList}</p>
          <p style="margin: 5px 0 0 0;"><strong>Date & Time:</strong><br>
          ${formatDate(booking.scheduled_date)}, ${formatTime(booking.scheduled_start)}</p>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Customer Information:</h3>
          <p style="margin: 0;"><strong>Name:</strong> ${customerInfo?.name || 'Not provided'}</p>
          <p style="margin: 5px 0;"><strong>Address:</strong> ${address}</p>
          ${unit ? `<p style="margin: 5px 0;"><strong>Unit:</strong> ${unit}</p>` : ''}
          ${apartmentName ? `<p style="margin: 5px 0;"><strong>Apartment:</strong> ${apartmentName}</p>` : ''}
          <p style="margin: 5px 0;"><strong>City:</strong> ${city}, ${zipCode}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${customerInfo?.phone || 'Not provided'}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${customerInfo?.email || 'Not provided'}</p>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background-color: #3498db; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Notes:</h3>
          <p style="margin: 0; background-color: #f8f9fa; padding: 15px; border-radius: 5px;">${specialInstructions}</p>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background-color: #e67e22; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">Important Reminders:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Arrive 15 minutes early for setup</li>
            <li>Bring all necessary tools and equipment</li>
            <li>Contact customer if running late</li>
            <li>Complete job documentation after service</li>
          </ul>
        </div>

        <div style="background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; text-align: center;">
          <h3 style="margin: 0 0 10px 0;">Support Contact:</h3>
          <p style="margin: 5px 0;"><strong>Email:</strong> Captain@herotvmounting.com</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> +1 737-272-9971</p>
          <p style="margin: 15px 0 0 0; font-size: 18px; font-weight: bold;">Good luck with your assignment!</p>
        </div>
      </body>
      </html>
    `;

    try {
      console.log('=== SENDING EMAIL ===');
      console.log('From:', resendFrom);
      console.log('To:', worker.email);
      console.log('Subject:', emailSubject);
      console.log('Force send:', force);
      
      const emailResponse = await resend.emails.send({
        from: resendFrom,
        to: [worker.email],
        subject: emailSubject,
        html: emailHtml,
        tags: [
          { name: 'booking_id', value: bookingId },
          { name: 'email_type', value: 'worker_assignment' }
        ],
      });

      console.log('=== EMAIL SENT SUCCESSFULLY ===');
      console.log('Resend response:', emailResponse);

      // Log successful email send in database - use upsert to handle duplicates
      const { error: logError } = await supabase.from('email_logs')
        .upsert({
          booking_id: bookingId,
          recipient_email: worker.email,
          subject: emailSubject,
          message: emailHtml,
          status: 'sent',
          email_type: 'worker_assignment',
          sent_at: new Date().toISOString(),
          // Store Resend message ID for tracking
          external_id: emailResponse.data?.id
        }, {
          onConflict: 'booking_id,recipient_email,email_type'
        });

      if (logError) {
        console.error('Failed to log email send:', logError);
      } else {
        console.log('Email send logged to database');
      }

      // Mark idempotency record as completed
      if (idempotencyRecordId) {
        const { error: idemUpdateErr } = await supabase
          .from('idempotency_records')
          .update({ status: 'completed', response_data: { emailId: emailResponse.data?.id } })
          .eq('id', idempotencyRecordId);
        if (idemUpdateErr) {
          console.log('Failed to update idempotency record to completed:', idemUpdateErr);
        }
      }

      console.log('=== Worker assignment notification COMPLETE ===');
      return new Response(JSON.stringify({
        success: true,
        emailId: emailResponse.data?.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (emailError: any) {
      console.error('=== EMAIL SEND FAILED ===');
      console.error('Error details:', {
        error: emailError,
        message: emailError?.message,
        status: emailError?.status,
        code: emailError?.code
      });

      // Determine error type for watchdog
      let errorType = 'smtp_error';
      const errorMessage = emailError?.message?.toLowerCase() || '';
      
      if (errorMessage.includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.includes('bounce') || errorMessage.includes('invalid')) {
        errorType = 'hard_bounce';
      } else if (errorMessage.includes('server') || errorMessage.includes('5')) {
        errorType = 'server_error';
      }

      // Log the email failure in database
      const { error: logError } = await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: worker.email,
        subject: emailSubject,
        message: emailHtml,
        status: 'failed',
        email_type: 'worker_assignment',
        error_message: emailError.message
      });

      if (logError) {
        console.error('Failed to log email error:', logError);
      }

      // Update idempotency record to failed
      if (idempotencyRecordId) {
        const { error: idemFailErr } = await supabase
          .from('idempotency_records')
          .update({ status: 'failed', response_data: { error: emailError.message } })
          .eq('id', idempotencyRecordId);
        if (idemFailErr) {
          console.log('Failed to update idempotency record to failed:', idemFailErr);
        }
      }

      // Trigger watchdog for email failure
      console.log('Triggering email failure watchdog...');
      try {
        await supabase.functions.invoke('email-failure-watchdog', {
          body: {
            bookingId: bookingId,
            workerId: workerId,
            originalError: emailError.message,
            errorType: errorType
          }
        });
        console.log('Watchdog triggered successfully');
      } catch (watchdogError) {
        console.error('Failed to trigger watchdog:', watchdogError);
      }

      // Return error response
      return new Response(JSON.stringify({
        success: false,
        error: 'Email send failed - watchdog activated',
        errorType: errorType
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('=== FUNCTION ERROR ===');
    console.error('Error details:', {
      error: error,
      message: error?.message,
      stack: error?.stack
    });
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
