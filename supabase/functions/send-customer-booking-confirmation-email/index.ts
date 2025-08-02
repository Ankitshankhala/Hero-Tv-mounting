import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      throw new Error('Booking ID is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching booking details for customer confirmation email:', bookingId);

    // Fetch booking details with service information and worker details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (name, description),
        worker:users!worker_id (
          id, name, phone, email
        ),
        customer:users!customer_id (
          id, name, email
        ),
        booking_services (
          service_name,
          quantity,
          base_price,
          configuration
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking:', bookingError);
      throw new Error('Booking not found');
    }

    console.log('Booking details fetched:', { 
      bookingId: booking.id,
      hasWorker: !!booking.worker,
      hasCustomer: !!booking.customer,
      hasGuestInfo: !!booking.guest_customer_info
    });

    // Extract customer information (handle both guest and registered customers)
    let customerEmail = '';
    let customerName = '';
    let customerPhone = '';
    let customerAddress = '';

    if (booking.customer) {
      // Registered customer
      customerEmail = booking.customer.email;
      customerName = booking.customer.name || 'Valued Customer';
    } else if (booking.guest_customer_info) {
      // Guest customer
      customerEmail = booking.guest_customer_info.email;
      customerName = booking.guest_customer_info.name || 'Valued Customer';
      customerPhone = booking.guest_customer_info.phone || '';
      customerAddress = booking.guest_customer_info.address || '';
    } else {
      throw new Error('No customer information found');
    }

    if (!customerEmail) {
      throw new Error('Customer email not found');
    }

    // Format booking date and time
    const bookingDate = new Date(booking.scheduled_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const bookingTime = new Date(`1970-01-01T${booking.scheduled_start}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Get service names
    const serviceNames = booking.booking_services?.map(bs => bs.service_name).join(', ') || booking.services?.name || 'Service';

    // Prepare worker information
    const workerInfo = booking.worker ? {
      name: booking.worker.name || 'Professional Technician',
      phone: booking.worker.phone || 'Contact support for details'
    } : null;

    // Create email subject and content
    const subject = `Booking Confirmed - ${serviceNames} on ${bookingDate}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .section { margin-bottom: 20px; }
            .highlight { background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Booking Confirmed!</h1>
              <p>Thank you for choosing Hero TV Mounting</p>
            </div>
            
            <div class="content">
              <div class="section">
                <h2>Hello ${customerName}!</h2>
                <p>Great news! Your booking has been confirmed and ${workerInfo ? 'we\'ve assigned a professional technician to your job' : 'we\'re finding the perfect technician for your job'}.</p>
              </div>

              <div class="section">
                <div class="highlight">
                  <h3>📋 Booking Details</h3>
                  <p><strong>Service:</strong> ${serviceNames}</p>
                  <p><strong>Date:</strong> ${bookingDate}</p>
                  <p><strong>Time:</strong> ${bookingTime}</p>
                  <p><strong>Booking ID:</strong> ${booking.id}</p>
                  ${customerAddress ? `<p><strong>Location:</strong> ${customerAddress}</p>` : ''}
                  ${booking.location_notes ? `<p><strong>Notes:</strong> ${booking.location_notes}</p>` : ''}
                </div>
              </div>

              ${workerInfo ? `
              <div class="section">
                <div class="highlight">
                  <h3>👨‍🔧 Your Assigned Technician</h3>
                  <p><strong>Name:</strong> ${workerInfo.name}</p>
                  <p><strong>Phone:</strong> ${workerInfo.phone}</p>
                  <p><em>Your technician will contact you 30 minutes before arrival.</em></p>
                </div>
              </div>
              ` : `
              <div class="section">
                <div class="highlight">
                  <h3>⏳ Technician Assignment</h3>
                  <p>We're currently finding the best available technician in your area. You'll receive another email once your technician is assigned with their contact details.</p>
                </div>
              </div>
              `}

              <div class="section">
                <h3>What's Next?</h3>
                <ul>
                  ${workerInfo ? 
                    '<li>Your technician will contact you 30 minutes before the scheduled time</li>' : 
                    '<li>We\'ll notify you once a technician is assigned</li>'
                  }
                  <li>Please ensure someone is available at the scheduled time</li>
                  <li>Have your TV and mounting location ready for assessment</li>
                  <li>Any additional charges will be discussed on-site before work begins</li>
                </ul>
              </div>

              <div class="section">
                <div class="highlight">
                  <h3>📞 Need Help?</h3>
                  <p>If you have any questions or need to reschedule, please contact us:</p>
                  <p><strong>Email:</strong> captain@herotvmounting.com</p>
                  <p><strong>Phone:</strong> +1 737-272-9971</p>
                </div>
              </div>
            </div>

            <div class="footer">
              <p>Thank you for choosing Hero TV Mounting!</p>
              <p>We look forward to providing you with excellent service.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Check if Resend API key is configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured. Mock sending customer confirmation email to:', customerEmail);
      
      // Log the mock email attempt
      await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: customerEmail,
        subject: subject,
        message: 'Customer booking confirmation email (mock)',
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Mock email logged - Resend not configured',
        recipient: customerEmail 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Send the email using Resend
    console.log('Sending customer confirmation email to:', customerEmail);
    
    const emailResult = await resend.emails.send({
      from: 'Hero TV Mounting <noreply@herotvmounting.com>',
      to: [customerEmail],
      subject: subject,
      html: emailHtml
    });

    if (emailResult.error) {
      console.error('Failed to send customer confirmation email:', emailResult.error);
      
      // Log the failed email attempt
      await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: customerEmail,
        subject: subject,
        message: 'Customer booking confirmation email',
        status: 'failed',
        error_message: emailResult.error.message || 'Unknown error'
      });

      throw new Error(`Failed to send email: ${emailResult.error.message}`);
    }

    console.log('Customer confirmation email sent successfully:', emailResult.data?.id);

    // Log the successful email attempt
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: customerEmail,
      subject: subject,
      message: 'Customer booking confirmation email',
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Customer confirmation email sent successfully',
      emailId: emailResult.data?.id,
      recipient: customerEmail
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error in customer confirmation email function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});