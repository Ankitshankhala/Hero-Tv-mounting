import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BOOKING-CONFIRMATION-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { bookingId } = await req.json();
    logStep("Processing booking confirmation email", { bookingId });

    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    // Get booking details with customer and worker information
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(name, email, phone),
        worker:users!bookings_worker_id_fkey(name, email, phone),
        booking_services(service_name, quantity, base_price, configuration)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    logStep("Booking retrieved", { status: booking.status, payment_status: booking.payment_status });

    // Check if this is Stage 1: Payment authorized AND worker assigned
    const isStage1 = booking.payment_status === 'authorized' && booking.worker_id;
    
    if (!isStage1) {
      logStep("Booking not ready for confirmation email", { 
        payment_status: booking.payment_status, 
        worker_assigned: !!booking.worker_id 
      });
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Booking not ready for confirmation email" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Determine customer email (registered user or guest)
    let customerEmail, customerName;
    if (booking.customer) {
      customerEmail = booking.customer.email;
      customerName = booking.customer.name;
    } else if (booking.guest_customer_info) {
      customerEmail = booking.guest_customer_info.email;
      customerName = booking.guest_customer_info.name;
    } else {
      throw new Error("No customer information found");
    }

    logStep("Customer information", { customerEmail, customerName });

    // Format booking date and time
    const bookingDate = new Date(booking.scheduled_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const bookingTime = booking.scheduled_start;
    
    // Calculate total price
    const totalPrice = booking.booking_services.reduce((sum: number, service: any) => 
      sum + (parseFloat(service.base_price) * service.quantity), 0
    );

    // Create services list HTML
    const servicesHtml = booking.booking_services.map((service: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${service.service_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${service.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(parseFloat(service.base_price) * service.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    // HTML email template for Stage 1
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed - Hero TV Mounting</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">Booking Confirmed!</h1>
    <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Your TV mounting service is scheduled</p>
  </div>
  
  <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0 0 15px; font-size: 20px;">📅 Service Details</h2>
      <p style="margin: 5px 0; font-size: 16px;"><strong>Date:</strong> ${bookingDate}</p>
      <p style="margin: 5px 0; font-size: 16px;"><strong>Time:</strong> ${bookingTime}</p>
      <p style="margin: 5px 0; font-size: 16px;"><strong>Booking ID:</strong> #${booking.id.slice(-8).toUpperCase()}</p>
    </div>

    <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h2 style="color: #27ae60; margin: 0 0 15px; font-size: 20px;">👨‍🔧 Your Assigned Technician</h2>
      <p style="margin: 5px 0; font-size: 16px;"><strong>Name:</strong> ${booking.worker.name}</p>
      <p style="margin: 5px 0; font-size: 16px;"><strong>Phone:</strong> ${booking.worker.phone}</p>
      <p style="margin: 15px 0 5px; font-size: 14px; color: #666;">Your technician will contact you 30 minutes before arrival to confirm the appointment.</p>
    </div>

    <div style="margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0 0 15px; font-size: 20px;">📋 Services Ordered</h2>
      <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Service</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${servicesHtml}
          <tr style="background: #f8f9fa; font-weight: bold;">
            <td style="padding: 12px; border-top: 2px solid #ddd;" colspan="2">Total Amount</td>
            <td style="padding: 12px; text-align: right; border-top: 2px solid #ddd;">$${totalPrice.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h3 style="color: #856404; margin: 0 0 10px; font-size: 16px;">💡 Important Reminders</h3>
      <ul style="margin: 0; padding-left: 20px; color: #856404;">
        <li>Please ensure the TV mounting area is accessible</li>
        <li>Have your TV manual available if possible</li>
        <li>Payment will be collected after service completion</li>
        <li>Contact us if you need to reschedule at least 24 hours in advance</li>
      </ul>
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 1px solid #eee;">
      <p style="margin: 0 0 15px; color: #666;">Need to contact us?</p>
      <p style="margin: 0; font-size: 16px;"><strong>Hero TV Mounting</strong></p>
      <p style="margin: 5px 0; color: #666;">Email: support@herotvmounting.com</p>
      <p style="margin: 5px 0; color: #666;">Phone: (555) 123-4567</p>
    </div>
  </div>
</body>
</html>`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Hero TV Mounting <bookings@herotvmounting.com>",
      to: [customerEmail],
      subject: `✅ Service Confirmed - ${bookingDate} at ${bookingTime}`,
      html: htmlContent,
    });

    logStep("Email sent", { emailId: emailResponse.data?.id });

    // Log email in database
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: customerEmail,
      subject: `✅ Service Confirmed - ${bookingDate} at ${bookingTime}`,
      message: 'Booking confirmation email with worker assignment',
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    logStep("Email logged in database");

    return new Response(JSON.stringify({
      success: true,
      message: "Booking confirmation email sent successfully",
      emailId: emailResponse.data?.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("ERROR", { message: errorMessage });

    // Try to log error in database if we have booking info
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const { bookingId } = await req.json().catch(() => ({}));
      if (bookingId) {
        await supabase.from('email_logs').insert({
          booking_id: bookingId,
          recipient_email: 'unknown',
          subject: 'Booking confirmation email',
          message: 'Failed to send booking confirmation email',
          status: 'failed',
          error_message: errorMessage
        });
      }
    } catch (logError) {
      logStep("Failed to log error", { logError });
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});