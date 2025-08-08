import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomerEmailRequest {
  bookingId: string;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateUuid = (uuid: string, fieldName: string): void => {
  if (!uuid || typeof uuid !== 'string') {
    throw new Error(`${fieldName} is required and must be a string`);
  }
  if (!UUID_REGEX.test(uuid)) {
    throw new Error(`${fieldName} must be a valid UUID format. Received: "${uuid}" (length: ${uuid.length})`);
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log('Customer booking confirmation email triggered');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse request body once and store for reuse
  let requestData: CustomerEmailRequest;
  
  try {
    const bodyText = await req.text();
    console.log('Raw request body:', bodyText);
    
    if (!bodyText.trim()) {
      throw new Error('Request body is empty');
    }
    
    requestData = JSON.parse(bodyText);
    console.log('Parsed request data:', requestData);
    
    // Validate input data
    if (!requestData.bookingId) {
      throw new Error('Missing required field: bookingId is required');
    }
    
    // Validate UUID format
    validateUuid(requestData.bookingId, 'bookingId');
    
    console.log('Processing customer email for booking:', requestData.bookingId);
    
  } catch (parseError: any) {
    console.error('Request parsing error:', parseError);
    return new Response(
      JSON.stringify({ 
        error: 'Invalid request format', 
        details: parseError.message,
        received: typeof parseError === 'object' ? 'Invalid JSON' : 'Unknown'
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // Idempotency guard: prevent duplicate customer emails within TTL
    const idempotencyKey = `customer_email_${requestData.bookingId}`;
    const requestHash = btoa(JSON.stringify({ bookingId: requestData.bookingId }));
    let idempotencyRecordId: string | null = null;

    try {
      const { data: existing } = await supabase
        .from('idempotency_records')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .eq('operation_type', 'customer_email')
        .single();

      if (existing) {
        const expired = new Date(existing.expires_at) < new Date();
        if (!expired) {
          if (existing.request_hash !== requestHash) {
            return new Response(JSON.stringify({ error: 'Idempotency key reused with different request' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          if (existing.status === 'completed') {
            return new Response(JSON.stringify(existing.response_data || { success: true, cached: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          if (existing.status === 'pending') {
            return new Response(JSON.stringify({ error: 'Operation in progress' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
        } else {
          await supabase.from('idempotency_records').delete().eq('id', existing.id);
        }
      }

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { data: created, error: idemInsertErr } = await supabase
        .from('idempotency_records')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: 'customer_email',
          request_hash: requestHash,
          user_id: booking?.customer_id || null,
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

    // Get booking details
    console.log('Fetching booking with ID:', requestData.bookingId);
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', requestData.bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Booking fetch error:', bookingError);
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }
    console.log('Booking fetched successfully:', booking.id);

    // Get booking services separately
    console.log('Fetching booking services for booking:', requestData.bookingId);
    const { data: bookingServices, error: servicesError } = await supabase
      .from('booking_services')
      .select('service_name, base_price, quantity, configuration')
      .eq('booking_id', requestData.bookingId);

    if (servicesError) {
      console.error('Booking services fetch error:', servicesError);
      throw new Error(`Failed to fetch booking services: ${servicesError?.message}`);
    }
    console.log('Booking services fetched:', bookingServices?.length || 0, 'services');

    // Get customer info if authenticated user
    let customerUser = null;
    if (booking.customer_id) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', booking.customer_id)
        .single();
      
      if (userError) {
        console.error('Customer user fetch error:', userError);
      } else {
        customerUser = user;
      }
    }

    // Get worker info if assigned
    let workerUser = null;
    if (booking.worker_id) {
      const { data: worker, error: workerError } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', booking.worker_id)
        .single();
      
      if (workerError) {
        console.error('Worker fetch error:', workerError);
      } else {
        workerUser = worker;
      }
    }

    // Determine customer email and name
    let customerEmail: string;
    let customerName: string;
    
    if (booking.customer_id && customerUser) {
      // Authenticated customer
      customerEmail = customerUser.email;
      customerName = customerUser.name || 'Customer';
    } else if (booking.guest_customer_info) {
      // Guest customer
      customerEmail = booking.guest_customer_info.email;
      customerName = booking.guest_customer_info.name || 'Customer';
    } else {
      throw new Error('No customer email found');
    }

    if (!customerEmail) {
      throw new Error('No customer email found');
    }

    console.log('Customer email determined:', customerEmail);
    console.log('Sending email to customer:', customerEmail, 'for booking:', requestData.bookingId);

    // Format service details
    const serviceDetails = bookingServices?.length ? 
      bookingServices.map((service: any) => {
        return `${service.service_name} (Qty: ${service.quantity}) - $${service.base_price}`;
      }).join('<br>') : 'Service details unavailable';

    const totalAmount = bookingServices?.length ? 
      bookingServices.reduce((sum: number, service: any) => 
        sum + (service.base_price * service.quantity), 0
      ) : 0;

    // Format scheduled date and time
    const scheduledDateTime = new Date(`${booking.scheduled_date}T${booking.scheduled_start}`);
    const formattedDate = scheduledDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = scheduledDateTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Worker information (if assigned)
    const workerInfo = workerUser?.name ? 
      `<p><strong>Assigned Worker:</strong> ${workerUser.name}<br>
       <strong>Worker Phone:</strong> ${workerUser.phone || 'Not provided'}</p>` : 
      '<p><strong>Worker:</strong> Will be assigned soon</p>';

    const htmlContent = `
      <h1>Booking Confirmation - Hero TV Mounting</h1>
      <p>Dear ${customerName},</p>
      
      <p>Thank you for choosing Hero TV Mounting! Your booking has been confirmed.</p>
      
      <h3>Booking Details:</h3>
      <p><strong>Booking ID:</strong> ${requestData.bookingId}</p>
      <p><strong>Scheduled Date:</strong> ${formattedDate}</p>
      <p><strong>Scheduled Time:</strong> ${formattedTime}</p>
      <p><strong>Status:</strong> ${booking.status}</p>
      
      <h3>Services:</h3>
      <p>${serviceDetails}</p>
      <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
      
      ${workerInfo}
      
      ${booking.location_notes ? `<p><strong>Location Notes:</strong> ${booking.location_notes}</p>` : ''}
      
      <p>If you have any questions, please contact us at:</p>
      <p>Email: Captain@herotvmounting.com<br>
      Phone: +1 737-272-9971</p>
      
      <p>Thank you for your business!</p>
      <p>Hero TV Mounting Team</p>
    `;

    // Retry send with basic backoff
    const sendWithRetry = async (attempts = 3) => {
      let lastError: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          return await resend.emails.send({
            from: "Hero TV Mounting <bookings@herotvmounting.com>",
            to: [customerEmail],
            subject: `Booking Confirmation - ${requestData.bookingId}`,
            html: htmlContent,
          });
        } catch (err) {
          lastError = err;
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
        }
      }
      throw lastError;
    };

    const emailResponse = await sendWithRetry();


    console.log('Customer email sent successfully:', emailResponse);

    // Log email attempt
    await supabase
      .from('email_logs')
      .insert({
        booking_id: requestData.bookingId,
        recipient_email: customerEmail,
        subject: `Booking Confirmation - ${requestData.bookingId}`,
        message: htmlContent,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    // Update idempotency record on success
    if (idempotencyRecordId) {
      await supabase
        .from('idempotency_records')
        .update({ status: 'completed', response_data: { success: true, messageId: emailResponse.data?.id } })
        .eq('id', idempotencyRecordId);
    }


    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error sending customer confirmation email:", error);
    console.error("Error stack:", error.stack);

    // Log failed email attempt using stored request data (avoid re-parsing consumed body)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
      // Mark idempotency record as failed if exists
      try {
        const idemKey = requestData?.bookingId ? `customer_email_${requestData.bookingId}` : null;
        if (idemKey) {
          await supabase
            .from('idempotency_records')
            .update({ status: 'failed', response_data: { error: error.message } })
            .eq('idempotency_key', idemKey)
            .eq('operation_type', 'customer_email');
        }
      } catch (idemUpdateErr) {
        console.warn('Failed to update idempotency on error:', idemUpdateErr);
      }

      // Use requestData if available, otherwise provide fallback values
      const bookingId = requestData?.bookingId || 'unknown';
      
      console.log('Logging failed email attempt for booking:', bookingId);

      await supabase
        .from('email_logs')
        .insert({
          booking_id: bookingId !== 'unknown' ? bookingId : null,
          recipient_email: 'unknown',
          subject: 'Booking Confirmation',
          message: 'Failed to send',
          status: 'failed',
          error_message: error.message,
          sent_at: new Date().toISOString()
        });
      
        console.log('Error logged successfully');
        // Send admin alert email (best-effort) with noise throttling (30m window)
        try {
          if (bookingId !== 'unknown') {
            const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            const { data: recentAlert } = await supabase
              .from('sms_logs')
              .select('id, created_at')
              .eq('booking_id', bookingId)
              .eq('recipient_number', 'admin_alert')
              .gte('created_at', thirtyMinAgo)
              .limit(1)
              .maybeSingle();

            if (!recentAlert) {
              const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
              await resend.emails.send({
                from: 'Hero TV Mounting <alerts@herotvmounting.com>',
                to: ['Captain@herotvmounting.com'],
                subject: 'ALERT: Customer confirmation email failed',
                html: `
                  <h2>Customer Email Failed</h2>
                  <p><strong>Booking:</strong> ${bookingId}</p>
                  <pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px;">${error.message}</pre>
                `,
              });

              // Log an admin alert marker for dedupe
              await supabase.from('sms_logs').insert({
                booking_id: bookingId,
                recipient_number: 'admin_alert',
                recipient_name: 'System',
                message: 'ALERT: Customer confirmation email failed',
                status: 'sent'
              });
            } else {
              console.log('Skipping admin alert email: recent alert already sent');
            }
          }
        } catch (alertErr) {
          console.warn('Failed to send admin alert email:', alertErr);
        }
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }


    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);