import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

const logStep = (step: string, details?: any) => {
  console.log(`[EMAIL-ORCHESTRATOR] ${step}`, details ? JSON.stringify(details) : '');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const url = new URL(req.url);
    const emailType = url.pathname.split('/').pop();

    logStep('Email orchestrator triggered', { emailType, body });

    switch (emailType) {
      case 'booking-confirmation':
        return await sendBookingConfirmation(body, supabase);
      case 'payment-reminder':
        return await sendPaymentReminder(body, supabase);
      case 'payment-pending':
        return await sendPaymentPending(body, supabase);
      case 'worker-welcome':
        return await sendWorkerWelcome(body, supabase);
      case 'worker-assignment':
        return await sendWorkerAssignment(body, supabase);
      default:
        // Legacy orchestrator behavior
        return await orchestrateNotifications(body, supabase);
    }

  } catch (error) {
    console.error('Email orchestrator error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function orchestrateNotifications(body: any, supabase: any) {
  const { bookingId, trigger } = body;

  if (!bookingId) {
    throw new Error('Booking ID is required');
  }

  // Get booking details
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    throw new Error('Booking not found');
  }

  logStep('Orchestrating notifications for booking', { bookingId: booking.id, trigger });

  return new Response(
    JSON.stringify({ success: true, message: 'Email orchestrator processed' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendBookingConfirmation(body: any, supabase: any) {
  const { bookingId } = body;
  
  // Get booking and customer details
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      booking_services(*),
      users(email, name)
    `)
    .eq('id', bookingId)
    .single();

  if (!booking) {
    throw new Error('Booking not found');
  }

  const customerEmail = booking.users?.email || booking.guest_customer_info?.email;
  const customerName = booking.users?.name || booking.guest_customer_info?.name;

  if (!customerEmail) {
    throw new Error('Customer email not found');
  }

  // Send email
  const { error: emailError } = await resend.emails.send({
    from: 'TV Mounting Service <bookings@tvmounting.com>',
    to: [customerEmail],
    subject: 'Booking Confirmation - TV Mounting Service',
    html: generateBookingConfirmationEmail(booking, customerName)
  });

  if (emailError) {
    throw new Error(`Failed to send email: ${emailError.message}`);
  }

  // Log email
  await supabase.from('email_logs').insert({
    booking_id: bookingId,
    email_type: 'booking_confirmation',
    recipient_email: customerEmail,
    status: 'sent'
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Booking confirmation sent' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendPaymentReminder(body: any, supabase: any) {
  const { bookingId, reminderType } = body;
  
  const { data: booking } = await supabase
    .from('bookings')
    .select(`*, users(email, name)`)
    .eq('id', bookingId)
    .single();

  const customerEmail = booking.users?.email || booking.guest_customer_info?.email;
  const customerName = booking.users?.name || booking.guest_customer_info?.name;

  const { error: emailError } = await resend.emails.send({
    from: 'TV Mounting Service <payments@tvmounting.com>',
    to: [customerEmail],
    subject: `Payment ${reminderType === 'final' ? 'Final ' : ''}Reminder - TV Mounting Service`,
    html: generatePaymentReminderEmail(booking, customerName, reminderType)
  });

  if (emailError) {
    throw new Error(`Failed to send email: ${emailError.message}`);
  }

  await supabase.from('email_logs').insert({
    booking_id: bookingId,
    email_type: `payment_reminder_${reminderType}`,
    recipient_email: customerEmail,
    status: 'sent'
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Payment reminder sent' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendPaymentPending(body: any, supabase: any) {
  const { bookingId } = body;
  
  const { data: booking } = await supabase
    .from('bookings')
    .select(`*, users(email, name)`)
    .eq('id', bookingId)
    .single();

  const customerEmail = booking.users?.email || booking.guest_customer_info?.email;
  const customerName = booking.users?.name || booking.guest_customer_info?.name;

  const { error: emailError } = await resend.emails.send({
    from: 'TV Mounting Service <payments@tvmounting.com>',
    to: [customerEmail],
    subject: 'Payment Pending - TV Mounting Service',
    html: generatePaymentPendingEmail(booking, customerName)
  });

  if (emailError) {
    throw new Error(`Failed to send email: ${emailError.message}`);
  }

  await supabase.from('email_logs').insert({
    booking_id: bookingId,
    email_type: 'payment_pending',
    recipient_email: customerEmail,
    status: 'sent'
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Payment pending notice sent' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendWorkerWelcome(body: any, supabase: any) {
  const { email, name, temporaryPassword } = body;

  const { error: emailError } = await resend.emails.send({
    from: 'TV Mounting Service <admin@tvmounting.com>',
    to: [email],
    subject: 'Welcome to TV Mounting Service - Worker Account Created',
    html: generateWorkerWelcomeEmail(name, temporaryPassword)
  });

  if (emailError) {
    throw new Error(`Failed to send email: ${emailError.message}`);
  }

  await supabase.from('email_logs').insert({
    email_type: 'worker_welcome',
    recipient_email: email,
    status: 'sent'
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Worker welcome email sent' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendWorkerAssignment(body: any, supabase: any) {
  const { bookingId, workerId } = body;
  
  const { data: booking } = await supabase
    .from('bookings')
    .select(`*, users!bookings_worker_id_fkey(email, name)`)
    .eq('id', bookingId)
    .single();

  const workerEmail = booking.users?.email;
  const workerName = booking.users?.name;

  if (!workerEmail) {
    throw new Error('Worker email not found');
  }

  const { error: emailError } = await resend.emails.send({
    from: 'TV Mounting Service <assignments@tvmounting.com>',
    to: [workerEmail],
    subject: 'New Job Assignment - TV Mounting Service',
    html: generateWorkerAssignmentEmail(booking, workerName)
  });

  if (emailError) {
    throw new Error(`Failed to send email: ${emailError.message}`);
  }

  await supabase.from('email_logs').insert({
    booking_id: bookingId,
    email_type: 'worker_assignment',
    recipient_email: workerEmail,
    status: 'sent'
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Worker assignment notification sent' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function generateBookingConfirmationEmail(booking: any, customerName: string): string {
  return `
    <h2>Booking Confirmation</h2>
    <p>Dear ${customerName},</p>
    <p>Your TV mounting service has been confirmed!</p>
    <h3>Booking Details:</h3>
    <ul>
      <li>Booking ID: ${booking.id}</li>
      <li>Date: ${booking.scheduled_date}</li>
      <li>Time: ${booking.scheduled_start}</li>
      <li>Status: ${booking.status}</li>
    </ul>
    <p>We'll send you updates as your appointment approaches.</p>
  `;
}

function generatePaymentReminderEmail(booking: any, customerName: string, reminderType: string): string {
  return `
    <h2>Payment ${reminderType === 'final' ? 'Final ' : ''}Reminder</h2>
    <p>Dear ${customerName},</p>
    <p>This is a ${reminderType} reminder that payment is required for your TV mounting service.</p>
    <h3>Booking Details:</h3>
    <ul>
      <li>Booking ID: ${booking.id}</li>
      <li>Date: ${booking.scheduled_date}</li>
      <li>Time: ${booking.scheduled_start}</li>
    </ul>
    <p>Please complete your payment to secure your booking.</p>
  `;
}

function generatePaymentPendingEmail(booking: any, customerName: string): string {
  return `
    <h2>Payment Pending</h2>
    <p>Dear ${customerName},</p>
    <p>Your payment is pending for the TV mounting service.</p>
    <h3>Booking Details:</h3>
    <ul>
      <li>Booking ID: ${booking.id}</li>
      <li>Date: ${booking.scheduled_date}</li>
      <li>Time: ${booking.scheduled_start}</li>
    </ul>
    <p>Your booking will be confirmed once payment is processed.</p>
  `;
}

function generateWorkerWelcomeEmail(name: string, temporaryPassword: string): string {
  return `
    <h2>Welcome to TV Mounting Service</h2>
    <p>Dear ${name},</p>
    <p>Your worker account has been created!</p>
    <h3>Login Details:</h3>
    <ul>
      <li>Temporary Password: ${temporaryPassword}</li>
    </ul>
    <p>Please log in and change your password immediately.</p>
  `;
}

function generateWorkerAssignmentEmail(booking: any, workerName: string): string {
  return `
    <h2>New Job Assignment</h2>
    <p>Dear ${workerName},</p>
    <p>You have been assigned a new TV mounting job!</p>
    <h3>Job Details:</h3>
    <ul>
      <li>Booking ID: ${booking.id}</li>
      <li>Date: ${booking.scheduled_date}</li>
      <li>Time: ${booking.scheduled_start}</li>
      <li>Location: ${booking.guest_customer_info?.city || 'TBD'}</li>
    </ul>
    <p>Please confirm your availability for this assignment.</p>
  `;
}