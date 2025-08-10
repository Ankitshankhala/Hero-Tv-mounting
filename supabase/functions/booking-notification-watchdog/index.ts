import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Load booking basics
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, created_at, worker_id, customer_id, guest_customer_info")
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

    // Fetch recent email logs for this booking
    const { data: emailLogs, error: logsErr } = await supabase
      .from("email_logs")
      .select("recipient_email, status, sent_at, created_at")
      .eq("booking_id", booking.id)
      .eq("status", "sent")
      .order("created_at", { ascending: false });

    if (logsErr) {
      console.error("Watchdog: email_logs error", logsErr);
    }

    const createdTs = new Date(booking.created_at).getTime();

    const wasEmailSentTo = (target: string | null | undefined) => {
      if (!target) return false;
      const targetLc = target.toLowerCase();
      return (emailLogs || []).some((row) => {
        const recipient = (row.recipient_email || "").toLowerCase();
        const ts = new Date((row.sent_at as string) || (row.created_at as string)).getTime();
        return recipient === targetLc && ts > createdTs;
      });
    };

    const customerEmailSent = wasEmailSentTo(customerEmail || undefined);
    const workerEmailSent = wasEmailSentTo(workerEmail || undefined);

    const actions: string[] = [];

    // Only (re)send emails that are missing
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

    return new Response(
      JSON.stringify({ bookingId, actions, customerEmail, workerEmail }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e: any) {
    console.error("Watchdog: error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
