import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EMAIL-ORCHESTRATOR] ${step}${detailsStr}`);
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

    const { bookingId, trigger } = await req.json();
    logStep("Processing email orchestration", { bookingId, trigger });

    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      throw new Error("Invalid booking ID format. Must be a valid UUID.");
    }

    // Get booking details to determine which email to send
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, payment_status, worker_id, status, created_at')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    logStep("Booking retrieved", { 
      payment_status: booking.payment_status, 
      worker_assigned: !!booking.worker_id,
      status: booking.status
    });

    // Check if we've already sent the appropriate email recently (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentEmails } = await supabase
      .from('email_logs')
      .select('subject, created_at')
      .eq('booking_id', bookingId)
      .eq('status', 'sent')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    // Determine which stage we're in and what email to send
    let emailType = null;
    let shouldSend = true;

    // Stage 1: Payment authorized AND worker assigned
    if (booking.payment_status === 'authorized' && booking.worker_id) {
      emailType = 'confirmation';
      // Check if we already sent a confirmation email recently
      const recentConfirmation = recentEmails?.find(email => 
        email.subject.includes('Service Confirmed') || 
        email.subject.includes('Booking Confirmed')
      );
      if (recentConfirmation) {
        logStep("Confirmation email already sent recently", { sentAt: recentConfirmation.created_at });
        shouldSend = false;
      }
    }
    // Stage 2: Booking made but payment incomplete (and no confirmation sent yet)
    else if (booking.payment_status === 'pending' || booking.payment_status === 'failed') {
      emailType = 'payment_reminder';
      // Check if we already sent a payment reminder recently
      const recentReminder = recentEmails?.find(email => 
        email.subject.includes('Complete Your Booking') || 
        email.subject.includes('Payment Reminder')
      );
      if (recentReminder) {
        logStep("Payment reminder already sent recently", { sentAt: recentReminder.created_at });
        shouldSend = false;
      }
      
      // Also don't send reminder if booking is too old (more than 48 hours)
      const bookingAge = Date.now() - new Date(booking.created_at).getTime();
      const fortyEightHours = 48 * 60 * 60 * 1000;
      if (bookingAge > fortyEightHours) {
        logStep("Booking too old for payment reminder", { ageHours: bookingAge / (60 * 60 * 1000) });
        shouldSend = false;
      }
    } else {
      logStep("Booking not eligible for email notification", { 
        payment_status: booking.payment_status, 
        worker_assigned: !!booking.worker_id 
      });
      shouldSend = false;
    }

    if (!shouldSend || !emailType) {
      return new Response(JSON.stringify({
        success: true,
        message: "No email needed at this time",
        reason: !shouldSend ? "Already sent recently" : "Not eligible"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Call the appropriate email function
    let emailFunction;
    if (emailType === 'confirmation') {
      emailFunction = 'send-booking-confirmation-email';
    } else if (emailType === 'payment_reminder') {
      emailFunction = 'send-payment-reminder-email';
    }

    logStep("Calling email function", { emailFunction, emailType });

    const { data: emailResult, error: emailError } = await supabase.functions.invoke(emailFunction, {
      body: { bookingId }
    });

    if (emailError) {
      throw new Error(`Email function error: ${emailError.message}`);
    }

    logStep("Email function completed", { result: emailResult });

    return new Response(JSON.stringify({
      success: true,
      message: `${emailType} email sent successfully`,
      emailType,
      result: emailResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("ERROR", { message: errorMessage });

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});