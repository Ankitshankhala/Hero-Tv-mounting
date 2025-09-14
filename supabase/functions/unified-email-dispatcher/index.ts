import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNIFIED-EMAIL-DISPATCHER] ${step}${detailsStr}`);
};

interface EmailRequest {
  bookingId?: string;
  emailType: 'confirmation' | 'payment_reminder' | 'worker_welcome' | 'customer_welcome';
  recipientEmail?: string;
  recipientType?: 'customer' | 'worker';
  templateData?: Record<string, any>;
  forceResend?: boolean;
  scheduledCheck?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      bookingId,
      emailType,
      recipientEmail,
      recipientType = 'customer',
      templateData = {},
      forceResend = false,
      scheduledCheck = false
    }: EmailRequest = await req.json();

    logStep('Starting unified email dispatch', { 
      emailType, 
      bookingId: bookingId ? 'provided' : null,
      recipientEmail: recipientEmail ? 'provided' : null,
      recipientType,
      scheduledCheck
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle scheduled check for payment reminders
    if (scheduledCheck && emailType === 'payment_reminder') {
      return await handleScheduledPaymentReminders(supabase);
    }

    // Validate required parameters for specific email types
    if (!bookingId && ['confirmation', 'payment_reminder'].includes(emailType)) {
      throw new Error(`Booking ID is required for ${emailType} emails`);
    }

    if (!recipientEmail && ['worker_welcome', 'customer_welcome'].includes(emailType)) {
      throw new Error(`Recipient email is required for ${emailType} emails`);
    }

    // Route to appropriate email function
    let targetFunction: string;
    let requestBody: any = { ...templateData };

    switch (emailType) {
      case 'confirmation':
        targetFunction = 'send-customer-booking-confirmation';
        requestBody.bookingId = bookingId;
        break;

      case 'payment_reminder':
        targetFunction = 'send-payment-reminder-email';
        requestBody.bookingId = bookingId;
        requestBody.forceResend = forceResend;
        break;

      case 'worker_welcome':
        targetFunction = 'send-worker-welcome-email';
        requestBody.email = recipientEmail;
        requestBody = { ...requestBody, ...templateData };
        break;

      case 'customer_welcome':
        targetFunction = 'send-customer-welcome-email';
        requestBody.email = recipientEmail;
        requestBody = { ...requestBody, ...templateData };
        break;

      default:
        throw new Error(`Unsupported email type: ${emailType}`);
    }

    // Check for recent duplicates if not forcing resend
    if (!forceResend && bookingId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const { data: recentEmails } = await supabase
        .from('email_logs')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('email_type', emailType)
        .gte('sent_at', oneHourAgo.toISOString())
        .limit(1);

      if (recentEmails && recentEmails.length > 0) {
        logStep('Duplicate email prevented', { bookingId, emailType });
        return new Response(JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Recent duplicate email prevented'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Invoke the target email function
    logStep('Invoking email function', { targetFunction, bookingId });
    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: requestBody,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (error) {
      logStep('Email function error', { error, targetFunction });
      throw new Error(`Failed to send ${emailType}: ${error.message}`);
    }

    logStep('Email sent successfully', { targetFunction, bookingId });

    return new Response(JSON.stringify({
      success: true,
      emailType,
      targetFunction,
      data
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    logStep('Error in unified email dispatcher', { error: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

async function handleScheduledPaymentReminders(supabase: any) {
  logStep('Starting scheduled payment reminder check');
  
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find pending bookings older than 2 minutes
  const { data: pendingBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, created_at, guest_customer_info, customer_id')
    .in('status', ['pending', 'payment_pending'])
    .lt('created_at', twoMinutesAgo.toISOString());

  if (bookingsError) {
    throw new Error(`Failed to fetch pending bookings: ${bookingsError.message}`);
  }

  logStep('Found pending bookings', { count: pendingBookings?.length || 0 });

  let processed = 0;
  let firstReminders = 0;
  let finalReminders = 0;
  let errors = 0;

  for (const booking of pendingBookings || []) {
    try {
      const bookingAge = Date.now() - new Date(booking.created_at).getTime();
      const isOlderThanOneHour = bookingAge > 60 * 60 * 1000;
      const isOlderThanTwentyFourHours = bookingAge > 24 * 60 * 60 * 1000;

      // Check for existing reminders
      const { data: existingReminders } = await supabase
        .from('email_logs')
        .select('email_type, sent_at')
        .eq('booking_id', booking.id)
        .in('email_type', ['first_payment_reminder', 'final_payment_reminder'])
        .order('sent_at', { ascending: false });

      const hasFirstReminder = existingReminders?.some(r => r.email_type === 'first_payment_reminder');
      const hasFinalReminder = existingReminders?.some(r => r.email_type === 'final_payment_reminder');

      // Skip if booking is too old (over 24 hours)
      if (isOlderThanTwentyFourHours) {
        processed++;
        continue;
      }

      // Send first reminder if older than 1 hour and no first reminder sent
      if (isOlderThanOneHour && !hasFirstReminder) {
        await supabase.functions.invoke('send-payment-reminder-email', {
          body: {
            bookingId: booking.id,
            reminderType: 'first'
          }
        });
        firstReminders++;
        logStep('Sent first payment reminder', { bookingId: booking.id });
      }
      
      // Send final reminder if older than 12 hours and no final reminder sent
      else if (bookingAge > 12 * 60 * 60 * 1000 && !hasFinalReminder) {
        await supabase.functions.invoke('send-payment-reminder-email', {
          body: {
            bookingId: booking.id,
            reminderType: 'final'
          }
        });
        finalReminders++;
        logStep('Sent final payment reminder', { bookingId: booking.id });
      }

      processed++;
    } catch (error) {
      logStep('Failed to process booking reminder', { 
        bookingId: booking.id, 
        error: error.message 
      });
      errors++;
    }
  }

  const result = {
    processed,
    first_reminders: firstReminders,
    final_reminders: finalReminders,
    errors
  };

  logStep('Scheduled check completed', result);

  return new Response(JSON.stringify({
    success: true,
    ...result
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}