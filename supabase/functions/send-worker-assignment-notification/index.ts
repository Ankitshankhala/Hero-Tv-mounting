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

const handler = async (req: Request): Promise<Response> => {
  console.log('Worker assignment notification email triggered');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    const { bookingId, workerId }: WorkerEmailRequest = await req.json();
    console.log('Processing worker assignment email for booking:', bookingId, 'worker:', workerId);

    // Get booking details with related data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (name, description),
        booking_services (service_name, base_price, quantity, configuration),
        users!bookings_customer_id_fkey (name, email, phone)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }

    // Get worker details
    const { data: worker, error: workerError } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', workerId)
      .single();

    if (workerError || !worker) {
      throw new Error(`Failed to fetch worker: ${workerError?.message}`);
    }

    if (!worker.email) {
      throw new Error('No worker email found');
    }

    // Determine customer contact info
    let customerName: string;
    let customerPhone: string;
    let customerEmail: string;
    
    if (booking.customer_id) {
      // Authenticated customer
      customerName = booking.users?.name || 'Customer';
      customerPhone = booking.users?.phone || 'Not provided';
      customerEmail = booking.users?.email || 'Not provided';
    } else {
      // Guest customer
      customerName = booking.guest_customer_info?.name || 'Customer';
      customerPhone = booking.guest_customer_info?.phone || 'Not provided';
      customerEmail = booking.guest_customer_info?.email || 'Not provided';
    }

    // Format service details
    const serviceDetails = booking.booking_services.map((service: any) => {
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
    }).join('<br>');

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
      <p><strong>Booking ID:</strong> ${bookingId}</p>
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
        booking_id: bookingId,
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

    // Log failed email attempt
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
      const { bookingId, workerId } = await req.json();
      const { data: worker } = await supabase
        .from('users')
        .select('email')
        .eq('id', workerId)
        .single();

      await supabase
        .from('email_logs')
        .insert({
          booking_id: bookingId,
          recipient_email: worker?.email || 'unknown',
          subject: 'New Job Assignment',
          message: 'Failed to send',
          status: 'failed',
          error_message: error.message
        });
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