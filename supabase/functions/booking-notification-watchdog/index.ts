import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Embedded idempotency helper to prevent duplicate operations
class IdempotencyHelper {
  private supabase: any;
  private recordId: string | null = null;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async checkAndStore(idempotencyKey: string, operationType: string, requestData: any): Promise<{ canProceed: boolean; existingResult?: any }> {
    const requestHash = await this.generateHash(JSON.stringify(requestData));
    
    // Check for existing record
    const { data: existing } = await this.supabase
      .from('idempotency_records')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('operation_type', operationType)
      .single();

    if (existing) {
      if (existing.status === 'completed') {
        return { canProceed: false, existingResult: existing.response_data };
      }
      if (existing.status === 'pending') {
        throw new Error('Operation already in progress');
      }
    }

    // Store new record
    const { data: newRecord } = await this.supabase
      .from('idempotency_records')
      .insert({
        idempotency_key: idempotencyKey,
        operation_type: operationType,
        request_hash: requestHash,
        user_id: '00000000-0000-0000-0000-000000000000', // System user
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour TTL
        status: 'pending'
      })
      .select()
      .single();

    this.recordId = newRecord?.id;
    return { canProceed: true };
  }

  async markCompleted(responseData: any): Promise<void> {
    if (this.recordId) {
      await this.supabase
        .from('idempotency_records')
        .update({
          status: 'completed',
          response_data: responseData,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.recordId);
    }
  }

  async markFailed(error: string): Promise<void> {
    if (this.recordId) {
      await this.supabase
        .from('idempotency_records')
        .update({
          status: 'failed',
          response_data: { error },
          updated_at: new Date().toISOString()
        })
        .eq('id', this.recordId);
    }
  }

  private async generateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

interface WatchdogRequest {
  bookingId: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    if (!bodyText) throw new Error("Missing body");
    const { bookingId } = JSON.parse(bodyText) as WatchdogRequest;

    if (!bookingId || !UUID_REGEX.test(bookingId)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing bookingId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Initialize idempotency helper
    const idempotency = new IdempotencyHelper(supabase);
    const idempotencyKey = `watchdog-${bookingId}`;
    
    // Check idempotency
    const { canProceed, existingResult } = await idempotency.checkAndStore(
      idempotencyKey,
      'email_watchdog',
      { bookingId }
    );

    if (!canProceed) {
      console.log(`Watchdog: operation already completed for booking ${bookingId}`);
      return new Response(
        JSON.stringify(existingResult),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Load booking basics with payment status for enhanced coverage
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, created_at, worker_id, customer_id, guest_customer_info, payment_status, status")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) {
      console.error("Watchdog: booking fetch error", bookingErr);
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Resolve recipient emails
    let customerEmail: string | null = null;
    let workerEmail: string | null = null;

    if (booking.customer_id) {
      const { data: cust, error: custErr } = await supabase
        .from("users")
        .select("email")
        .eq("id", booking.customer_id)
        .single();
      if (!custErr) customerEmail = (cust?.email || null);
    } else {
      customerEmail = booking.guest_customer_info?.email || null;
    }

    if (booking.worker_id) {
      const { data: wrk, error: wrkErr } = await supabase
        .from("users")
        .select("email")
        .eq("id", booking.worker_id)
        .single();
      if (!wrkErr) workerEmail = (wrk?.email || null);
    }

    // Fetch recent email logs for this booking with email_type for better tracking
    const { data: emailLogs, error: logsErr } = await supabase
      .from("email_logs")
      .select("recipient_email, status, sent_at, created_at, email_type")
      .eq("booking_id", booking.id)
      .eq("status", "sent")
      .order("created_at", { ascending: false });

    if (logsErr) {
      console.error("Watchdog: email_logs error", logsErr);
    }

    const createdTs = new Date(booking.created_at).getTime();

    const wasEmailSentTo = (target: string | null | undefined, emailType: string = 'general') => {
      if (!target) return false;
      const targetLc = target.toLowerCase();
      return (emailLogs || []).some((row) => {
        const recipient = (row.recipient_email || "").toLowerCase();
        const ts = new Date((row.sent_at as string) || (row.created_at as string)).getTime();
        const logEmailType = row.email_type || 'general';
        return recipient === targetLc && ts > createdTs && 
               (emailType === 'general' || logEmailType === emailType);
      });
    };

    // Enhanced email coverage checks
    const customerEmailSent = wasEmailSentTo(customerEmail || undefined, 'booking_confirmation');
    const workerEmailSent = wasEmailSentTo(workerEmail || undefined, 'worker_assignment');
    const paymentPendingSent = wasEmailSentTo(customerEmail || undefined, 'payment_pending');
    const paymentReminderSent = wasEmailSentTo(customerEmail || undefined, 'payment_reminder');

    const actions: string[] = [];
    const now = Date.now();
    const bookingAge = now - createdTs;
    const twoHoursMs = 2 * 60 * 60 * 1000;

    // 1. Core confirmation emails (existing logic)
    if (!customerEmailSent && customerEmail) {
      const { error } = await supabase.functions.invoke("send-customer-booking-confirmation", {
        body: { bookingId },
      });
      if (!error) actions.push("sent_customer_email");
      else console.error("Watchdog: failed to invoke customer email", error);
    }

    if (booking.worker_id && !workerEmailSent && workerEmail) {
      const { error } = await supabase.functions.invoke("send-worker-assignment-notification", {
        body: { bookingId, workerId: booking.worker_id },
      });
      if (!error) actions.push("sent_worker_email");
      else console.error("Watchdog: failed to invoke worker email", error);
    }

    // 2. Payment pending notices (for new bookings)
    if (booking.payment_status === 'pending' && !paymentPendingSent && customerEmail) {
      const { error } = await supabase.functions.invoke("send-payment-pending-notice", {
        body: { bookingId },
      });
      if (!error) actions.push("sent_payment_pending");
      else console.error("Watchdog: failed to invoke payment pending notice", error);
    }

    // 3. Payment reminders (for bookings older than 2 hours with pending payment)
    if (booking.payment_status === 'pending' && bookingAge > twoHoursMs && 
        !paymentReminderSent && customerEmail) {
      const { error } = await supabase.functions.invoke("send-payment-reminder-email", {
        body: { bookingId },
      });
      if (!error) actions.push("sent_payment_reminder");
      else console.error("Watchdog: failed to invoke payment reminder", error);
    }

    // Log summary
    if (actions.length > 0) {
      await supabase.from("sms_logs").insert({
        booking_id: booking.id,
        recipient_number: "system",
        message: `Watchdog actions: ${actions.join(", ")}`,
        status: "sent",
      });
    } else {
      await supabase.from("sms_logs").insert({
        booking_id: booking.id,
        recipient_number: "system",
        message: "Watchdog: no action needed (emails already sent)",
        status: "sent",
      });
    }

    const result = { bookingId, actions, customerEmail, workerEmail };
    
    // Mark idempotency operation as completed
    await idempotency.markCompleted(result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e: any) {
    console.error("Watchdog: error", e);
    
    // Mark idempotency operation as failed if helper exists
    try {
      const idempotency = new IdempotencyHelper(createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      ));
      await idempotency.markFailed(e?.message || "Unexpected error");
    } catch (idempotencyError) {
      console.error("Watchdog: Failed to mark idempotency as failed", idempotencyError);
    }
    
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
