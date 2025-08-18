import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentPendingRequest {
  bookingId: string;
  trigger?: string;
}

const logStep = (step: string, data?: any) => {
  console.log(`[PAYMENT-PENDING-NOTICE] ${step}${data ? ` - ${JSON.stringify(data)}` : ''}`);
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      supabaseServiceRoleKey
    );

    const { bookingId }: PaymentPendingRequest = await req.json();
    logStep("Processing payment pending notice", { bookingId });

    if (!bookingId) {
      throw new Error("bookingId is required");
    }

    // Check if we've already sent this notification to prevent duplicates
    const { data: existingLog } = await supabase
      .from("email_logs")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("email_type", "payment_pending")
      .single();

    if (existingLog) {
      logStep("Payment pending notice already sent", { bookingId });
      return new Response(
        JSON.stringify({ success: true, message: "Notice already sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch booking details with customer information
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        payment_status,
        status,
        scheduled_date,
        scheduled_start,
        created_at,
        customer_id,
        guest_customer_info
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message || "Unknown error"}`);
    }

    logStep("Booking details retrieved", { 
      bookingId: booking.id, 
      paymentStatus: booking.payment_status,
      status: booking.status 
    });

    // Only send for pending payment bookings
    if (booking.payment_status !== 'pending' && booking.payment_status !== null) {
      logStep("Booking payment is not pending, skipping notification", { 
        paymentStatus: booking.payment_status 
      });
      return new Response(
        JSON.stringify({ success: true, message: "Payment not pending, no notification sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer email
    let customerEmail: string;
    let customerName: string;

    if (booking.customer_id) {
      // Registered customer
      const { data: customer } = await supabase
        .from("users")
        .select("email, name")
        .eq("id", booking.customer_id)
        .single();

      if (!customer?.email) {
        throw new Error("Customer email not found");
      }

      customerEmail = customer.email;
      customerName = customer.name || "Customer";
    } else if (booking.guest_customer_info) {
      // Guest customer
      customerEmail = booking.guest_customer_info.email;
      customerName = booking.guest_customer_info.name || "Customer";
    } else {
      throw new Error("No customer information found");
    }

    // Format date and time
    const scheduledDate = new Date(booking.scheduled_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const scheduledTime = booking.scheduled_start
      ? new Date(`1970-01-01T${booking.scheduled_start}`).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "Time TBD";

    // Email content
    const subject = "Payment Required to Confirm Your Booking";
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h1 style="color: #856404; margin: 0 0 20px 0; font-size: 24px;">Payment Required</h1>
            
            <p style="margin-bottom: 20px;">Dear ${customerName},</p>
            
            <p style="margin-bottom: 20px;">
              Thank you for requesting a booking with Hero TV Mounting. We've received your booking request, but 
              <strong>your booking is not yet confirmed</strong> because payment has not been completed.
            </p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
              <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 18px;">Important Notice:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #856404;">
                <li><strong>No worker will be assigned</strong> until payment is confirmed</li>
                <li>This booking slot will only be held for <strong>10 minutes</strong></li>
                <li>After 10 minutes, your booking will be automatically cancelled if payment is not completed</li>
              </ul>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #495057; margin: 0 0 10px 0;">Your Booking Details:</h3>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${scheduledDate}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${scheduledTime}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Pending Payment</p>
            </div>
            
            <p style="margin-bottom: 20px;">
              To secure your preferred time slot, please complete your payment as soon as possible.
            </p>
            
            <p style="margin-bottom: 20px;">
              If you have any questions or need assistance, please don't hesitate to contact us.
            </p>
            
            <p style="margin-bottom: 10px;">Best regards,</p>
            <p style="margin: 0; font-weight: bold;">The Hero TV Mounting Team</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; font-size: 12px; color: #6c757d; text-align: center;">
            This is an automated message. Please do not reply to this email.
          </div>
        </body>
      </html>
    `;

    const textBody = `
Payment Required to Confirm Your Booking

Dear ${customerName},

Thank you for requesting a booking with Hero TV Mounting. We've received your booking request, but your booking is not yet confirmed because payment has not been completed.

IMPORTANT NOTICE:
- No worker will be assigned until payment is confirmed
- This booking slot will only be held for 10 minutes
- After 10 minutes, your booking will be automatically cancelled if payment is not completed

Your Booking Details:
Date: ${scheduledDate}
Time: ${scheduledTime}
Status: Pending Payment

To secure your preferred time slot, please complete your payment as soon as possible.

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
The Hero TV Mounting Team

---
This is an automated message. Please do not reply to this email.
    `;

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: "Hero TV Mounting <bookings@herotvmounting.com>",
      to: [customerEmail],
      subject: subject,
      html: htmlBody,
      text: textBody,
    });

    if (emailResponse.error) {
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    logStep("Payment pending notice email sent successfully", { 
      emailId: emailResponse.data?.id,
      recipient: customerEmail 
    });

    // Log the email in the database
    await supabase
      .from("email_logs")
      .insert({
        booking_id: booking.id,
        recipient_email: customerEmail,
        subject: subject,
        message: textBody,
        status: "sent",
        email_type: "payment_pending",
        sent_at: new Date().toISOString(),
      });

    logStep("Email logged in database");

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id,
        message: "Payment pending notice sent successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);