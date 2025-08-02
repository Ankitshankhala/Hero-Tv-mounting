import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkerEmailRequest {
  bookingId: string;
  workerId: string;
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
  console.log('Worker assignment notification email triggered');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse request body once and store for reuse
  let requestData: WorkerEmailRequest;
  
  try {
    const bodyText = await req.text();
    console.log('Raw request body:', bodyText);
    
    if (!bodyText.trim()) {
      throw new Error('Request body is empty');
    }
    
    requestData = JSON.parse(bodyText);
    console.log('Parsed request data:', requestData);
    
    // Validate input data
    if (!requestData.bookingId || !requestData.workerId) {
      throw new Error('Missing required fields: bookingId and workerId are required');
    }
    
    // Validate UUID formats
    validateUuid(requestData.bookingId, 'bookingId');
    validateUuid(requestData.workerId, 'workerId');
    
    console.log('Processing worker assignment email for booking:', requestData.bookingId, 'worker:', requestData.workerId);
    
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

    // Get worker details
    console.log('Fetching worker with ID:', requestData.workerId);
    const { data: worker, error: workerError } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', requestData.workerId)
      .single();

    if (workerError || !worker) {
      console.error('Worker fetch error:', workerError);
      throw new Error(`Failed to fetch worker: ${workerError?.message}`);
    }

    if (!worker.email) {
      throw new Error('No worker email found');
    }

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

    console.log('Worker fetched successfully:', worker.name, worker.email);
    console.log('Sending worker assignment email to:', worker.email, 'for booking:', requestData.bookingId);

    // Determine customer contact info
    let customerName: string;
    let customerPhone: string;
    let customerEmail: string;
    
    if (booking.customer_id && customerUser) {
      // Authenticated customer
      customerName = customerUser.name || 'Customer';
      customerPhone = customerUser.phone || 'Not provided';
      customerEmail = customerUser.email || 'Not provided';
    } else if (booking.guest_customer_info) {
      // Guest customer
      customerName = booking.guest_customer_info.name || 'Customer';
      customerPhone = booking.guest_customer_info.phone || 'Not provided';
      customerEmail = booking.guest_customer_info.email || 'Not provided';
    } else {
      customerName = 'Customer';
      customerPhone = 'Not provided';
      customerEmail = 'Not provided';
    }

    // Format service details
    const serviceDetails = bookingServices?.length ? 
      bookingServices.map((service: any) => {
      const config = service.configuration;
      let configDetails = '';
      
      if (config && typeof config === 'object') {
        // Handle TV mounting specific configuration
        if (config.wallType) configDetails += `Wall Type: ${config.wallType}<br>`;
        if (config.tvSize) configDetails += `TV Size: ${config.tvSize}<br>`;
        if (config.mountType) configDetails += `Mount Type: ${config.mountType}<br>`;
        if (config.cableManagement) configDetails += `Cable Management: Yes<br>`;
      }
      
        return `<strong>${service.service_name}</strong> (Qty: ${service.quantity}) - $${service.base_price}<br>${configDetails}`;
      }).join('<br>') : 'Service details unavailable';

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

    // Get location details from guest info or user profile
    const location = booking.guest_customer_info?.zipcode ? 
      `${booking.guest_customer_info.city}, ${booking.guest_customer_info.state} ${booking.guest_customer_info.zipcode}` :
      'Location details in customer contact';

    const htmlContent = `
      <h1>New Job Assignment - Hero TV Mounting</h1>
      <p>Hello ${worker.name},</p>
      
      <p>You have been assigned to a new job. Please review the details below:</p>
      
      <h3>Job Details:</h3>
      <p><strong>Booking ID:</strong> ${requestData.bookingId}</p>
      <p><strong>Scheduled Date:</strong> ${formattedDate}</p>
      <p><strong>Scheduled Time:</strong> ${formattedTime}</p>
      <p><strong>Location:</strong> ${location}</p>
      
      <h3>Customer Information:</h3>
      <p><strong>Name:</strong> ${customerName}</p>
      <p><strong>Phone:</strong> ${customerPhone}</p>
      <p><strong>Email:</strong> ${customerEmail}</p>
      
      <h3>Services Required:</h3>
      <div>${serviceDetails}</div>
      
      ${booking.location_notes ? `<h3>Special Instructions:</h3><p>${booking.location_notes}</p>` : ''}
      
      <h3>Important Reminders:</h3>
      <ul>
        <li>Arrive 15 minutes early for setup</li>
        <li>Bring all necessary tools and equipment</li>
        <li>Contact customer if running late</li>
        <li>Complete job documentation after service</li>
      </ul>
      
      <p>For support or questions, contact the office:</p>
      <p>Email: dispatch@herotvmounting.com<br>
      Phone: (555) 123-4567</p>
      
      <p>Good luck with your assignment!</p>
      <p>Hero TV Mounting Team</p>
    `;

    const emailResponse = await resend.emails.send({
      from: "Hero TV Mounting <dispatch@herotvmounting.com>",
      to: [worker.email],
      subject: `New Job Assignment - ${formattedDate} at ${formattedTime}`,
      html: htmlContent,
    });

    console.log('Worker assignment email sent successfully:', emailResponse);

    // Log email attempt
    await supabase
      .from('email_logs')
      .insert({
        booking_id: requestData.bookingId,
        recipient_email: worker.email,
        subject: `New Job Assignment - ${formattedDate} at ${formattedTime}`,
        message: htmlContent,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

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
    console.error("Error sending worker assignment email:", error);
    console.error("Error stack:", error.stack);

    // Log failed email attempt using stored request data (avoid re-parsing consumed body)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
      // Use requestData if available, otherwise provide fallback values
      const bookingId = requestData?.bookingId || 'unknown';
      const workerId = requestData?.workerId || 'unknown';
      
      console.log('Logging failed email attempt for booking:', bookingId, 'worker:', workerId);
      
      let workerEmail = 'unknown';
      if (workerId !== 'unknown' && UUID_REGEX.test(workerId)) {
        const { data: worker } = await supabase
          .from('users')
          .select('email')
          .eq('id', workerId)
          .single();
        workerEmail = worker?.email || 'unknown';
      }

      await supabase
        .from('email_logs')
        .insert({
          booking_id: bookingId !== 'unknown' ? bookingId : null,
          recipient_email: workerEmail,
          subject: 'New Job Assignment',
          message: 'Failed to send',
          status: 'failed',
          error_message: error.message,
          sent_at: new Date().toISOString()
        });
      
      console.log('Error logged successfully');
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