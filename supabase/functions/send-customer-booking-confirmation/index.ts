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

const handler = async (req: Request): Promise<Response> => {
  console.log('Customer booking confirmation email triggered');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    const { bookingId }: CustomerEmailRequest = await req.json();
    console.log('Processing customer email for booking:', bookingId);

    // Get booking details with related data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (name, description),
        booking_services (service_name, base_price, quantity, configuration),
        users!bookings_worker_id_fkey (name, email, phone),
        users!bookings_customer_id_fkey (name, email, phone)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }

    // Determine customer email and name
    let customerEmail: string;
    let customerName: string;
    
    if (booking.customer_id) {
      // Authenticated customer
      customerEmail = booking.users.email;
      customerName = booking.users.name || 'Customer';
    } else {
      // Guest customer
      customerEmail = booking.guest_customer_info?.email;
      customerName = booking.guest_customer_info?.name || 'Customer';
    }

    if (!customerEmail) {
      throw new Error('No customer email found');
    }

    // Format service details
    const serviceDetails = booking.booking_services.map((service: any) => {
      return `${service.service_name} (Qty: ${service.quantity}) - $${service.base_price}`;
    }).join('<br>');

    const totalAmount = booking.booking_services.reduce((sum: number, service: any) => 
      sum + (service.base_price * service.quantity), 0
    );

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
    const workerInfo = booking.users?.name ? 
      `<p><strong>Assigned Worker:</strong> ${booking.users.name}<br>
       <strong>Worker Phone:</strong> ${booking.users.phone || 'Not provided'}</p>` : 
      '<p><strong>Worker:</strong> Will be assigned soon</p>';

    const htmlContent = `
      <h1>Booking Confirmation - Hero TV Mounting</h1>
      <p>Dear ${customerName},</p>
      
      <p>Thank you for choosing Hero TV Mounting! Your booking has been confirmed.</p>
      
      <h3>Booking Details:</h3>
      <p><strong>Booking ID:</strong> ${bookingId}</p>
      <p><strong>Scheduled Date:</strong> ${formattedDate}</p>
      <p><strong>Scheduled Time:</strong> ${formattedTime}</p>
      <p><strong>Status:</strong> ${booking.status}</p>
      
      <h3>Services:</h3>
      <p>${serviceDetails}</p>
      <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
      
      ${workerInfo}
      
      ${booking.location_notes ? `<p><strong>Location Notes:</strong> ${booking.location_notes}</p>` : ''}
      
      <p>If you have any questions, please contact us at:</p>
      <p>Email: support@herotvmounting.com<br>
      Phone: (555) 123-4567</p>
      
      <p>Thank you for your business!</p>
      <p>Hero TV Mounting Team</p>
    `;

    const emailResponse = await resend.emails.send({
      from: "Hero TV Mounting <bookings@herotvmounting.com>",
      to: [customerEmail],
      subject: `Booking Confirmation - ${bookingId}`,
      html: htmlContent,
    });

    console.log('Customer email sent successfully:', emailResponse);

    // Log email attempt
    await supabase
      .from('email_logs')
      .insert({
        booking_id: bookingId,
        recipient_email: customerEmail,
        subject: `Booking Confirmation - ${bookingId}`,
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
    console.error("Error sending customer confirmation email:", error);

    // Log failed email attempt
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
      const { bookingId } = await req.json();
      await supabase
        .from('email_logs')
        .insert({
          booking_id: bookingId,
          recipient_email: 'unknown',
          subject: 'Booking Confirmation',
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