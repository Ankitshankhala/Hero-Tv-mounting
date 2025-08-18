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
  console.log(`[PAYMENT-REMINDER-EMAIL] ${step}${detailsStr}`);
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
    logStep("Processing payment reminder email", { bookingId });

    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      throw new Error("Invalid booking ID format. Must be a valid UUID.");
    }

    // Get booking details first
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    // Get customer information if it's a registered user
    let customer = null;
    if (booking.customer_id) {
      const { data: customerData } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', booking.customer_id)
        .single();
      customer = customerData;
    }

    // Get booking services separately
    const { data: bookingServices } = await supabase
      .from('booking_services')
      .select('service_name, quantity, base_price, configuration')
      .eq('booking_id', bookingId);

    // Add services to booking object for compatibility
    booking.customer = customer;
    booking.booking_services = bookingServices || [];


    logStep("Booking retrieved", { status: booking.status, payment_status: booking.payment_status });

    // Check if this is Stage 2: Booking made but payment not completed
    const isStage2 = booking.payment_status === 'pending' || booking.payment_status === 'failed';
    
    if (!isStage2) {
      logStep("Booking not eligible for payment reminder", { 
        payment_status: booking.payment_status 
      });
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Booking not eligible for payment reminder" 
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

    // Create payment link (this would be your actual payment processing URL)
    const paymentLink = `https://herotvmounting.com/complete-payment?booking=${booking.id}`;

    // HTML email template for Stage 2
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your Booking Payment - Hero TV Mounting</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ff7b7b 0%, #667eea 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">Complete Your Booking</h1>
    <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Your TV mounting service is reserved - just one step left!</p>
  </div>
  
  <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px;">
    <div style="text-align: center; margin-bottom: 25px;">
      <p style="font-size: 18px; margin: 0 0 10px;">Hi ${customerName},</p>
      <p style="font-size: 16px; color: #666; margin: 0;">We're holding your preferred time slot, but we need payment authorization to confirm your booking.</p>
    </div>

    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
      <h2 style="color: #856404; margin: 0 0 15px; font-size: 18px;">⏰ Time-Sensitive Reservation</h2>
      <p style="margin: 0; color: #856404; font-size: 14px;">This time slot will be released to other customers if payment isn't completed within 24 hours.</p>
    </div>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0 0 15px; font-size: 20px;">📅 Your Reserved Service</h2>
      <p style="margin: 5px 0; font-size: 16px;"><strong>Date:</strong> ${bookingDate}</p>
      <p style="margin: 5px 0; font-size: 16px;"><strong>Time:</strong> ${bookingTime}</p>
      <p style="margin: 5px 0; font-size: 16px;"><strong>Booking ID:</strong> #${booking.id.slice(-8).toUpperCase()}</p>
    </div>

    <div style="margin-bottom: 25px;">
      <h2 style="color: #2c3e50; margin: 0 0 15px; font-size: 20px;">📋 Service Summary</h2>
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
            <td style="padding: 12px; text-align: right; border-top: 2px solid #ddd; color: #e74c3c; font-size: 18px;">$${totalPrice.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${paymentLink}" style="background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3); transition: all 0.3s ease;">
        🔒 Complete Payment & Confirm Booking
      </a>
      <p style="margin: 15px 0 0; font-size: 14px; color: #666;">Secure payment processing • No payment until service is completed</p>
    </div>

    <div style="background: #e8f5e8; border: 1px solid #c3e6c3; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h3 style="color: #27ae60; margin: 0 0 10px; font-size: 16px;">✅ What Happens After Payment Authorization?</h3>
      <ul style="margin: 0; padding-left: 20px; color: #27ae60;">
        <li>Your time slot is immediately confirmed</li>
        <li>We'll assign your preferred technician</li>
        <li>You'll receive full booking details and contact information</li>
        <li>No money is charged until after service completion</li>
      </ul>
    </div>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h3 style="color: #2c3e50; margin: 0 0 10px; font-size: 16px;">❓ Have Questions?</h3>
      <p style="margin: 0; color: #666; font-size: 14px;">Contact our customer service team at support@herotvmounting.com or call (555) 123-4567. We're here to help!</p>
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 1px solid #eee;">
      <p style="margin: 0; font-size: 16px;"><strong>Hero TV Mounting</strong></p>
      <p style="margin: 5px 0; color: #666; font-size: 14px;">Professional TV mounting services you can trust</p>
    </div>
  </div>
</body>
</html>`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Hero TV Mounting <bookings@herotvmounting.com>",
      to: [customerEmail],
      subject: `⏰ Complete Your Booking - ${bookingDate} at ${bookingTime}`,
      html: htmlContent,
    });

    logStep("Email sent", { emailId: emailResponse.data?.id });

    // Log email in database
    await supabase.from('email_logs').insert({
      booking_id: bookingId,
      recipient_email: customerEmail,
      subject: `⏰ Complete Your Booking - ${bookingDate} at ${bookingTime}`,
      message: 'Payment reminder email for incomplete booking',
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    logStep("Email logged in database");

    return new Response(JSON.stringify({
      success: true,
      message: "Payment reminder email sent successfully",
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
          subject: 'Payment reminder email',
          message: 'Failed to send payment reminder email',
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