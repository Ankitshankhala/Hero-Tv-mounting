import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomerWorkerSmsRequest {
  bookingId: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  // timeStr expected like "14:00:00"; build date to format time
  const d = new Date();
  const [h, m, s] = timeStr.split(":").map(Number);
  d.setHours(h || 0, m || 0, s || 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = (await req.json()) as CustomerWorkerSmsRequest;

    if (!bookingId || typeof bookingId !== "string") {
      return new Response(JSON.stringify({ error: "bookingId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Load booking, worker, and customer info
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `id, scheduled_date, scheduled_start, 
         guest_customer_info, 
         worker:users!bookings_worker_id_fkey(id, name, phone),
         customer:users!bookings_customer_id_fkey(id, name, phone),
         booking_services(service_name)`
      )
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Failed to load booking:", bookingError);
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const workerName: string = booking.worker?.name || "your assigned pro";
    const workerPhone: string | null = booking.worker?.phone || null;

    // Determine customer phone
    const customerPhone: string | null = booking.customer?.phone || booking.guest_customer_info?.phone || null;
    const customerName: string = booking.customer?.name || booking.guest_customer_info?.name || "Customer";

    if (!customerPhone) {
      // Nothing to send if no phone found
      return new Response(JSON.stringify({ error: "Customer phone not available" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const dateText = formatDate(booking.scheduled_date);
    const timeText = formatTime(booking.scheduled_start);
    const primaryService = Array.isArray(booking.booking_services) && booking.booking_services.length > 0
      ? booking.booking_services[0]?.service_name
      : undefined;

    const lines: string[] = [];
    lines.push(`Hi ${customerName}, your booking is confirmed.`);
    if (primaryService) lines.push(`Service: ${primaryService}.`);
    lines.push(`Pro: ${workerName}${workerPhone ? ` (${workerPhone})` : ''}.`);
    if (dateText || timeText) lines.push(`When: ${dateText} ${timeText}`.trim());
    lines.push("Reply to this SMS if you need help or to update details.");

    const message = lines.join(" \n");

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");

    let status: "sent" | "failed" = "sent";
    let twilioSid: string | null = null;
    let errorMessage: string | null = null;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      console.log("Twilio not configured. Mocking SMS send.", { to: customerPhone, message });
    } else {
      try {
        const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const body = new URLSearchParams({
          To: customerPhone,
          From: TWILIO_FROM_NUMBER,
          Body: message,
        });

        const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });

        const twilioData = await resp.json();
        if (!resp.ok) {
          status = "failed";
          errorMessage = twilioData?.message || `Twilio error ${resp.status}`;
        } else {
          twilioSid = twilioData?.sid || null;
        }
      } catch (err: any) {
        console.error("Twilio send failed:", err);
        status = "failed";
        errorMessage = err?.message || "Unknown Twilio error";
      }
    }

    // Log SMS
    const { error: logError } = await supabase.from("sms_logs").insert({
      booking_id: bookingId,
      recipient_number: customerPhone,
      recipient_name: customerName,
      message,
      status,
      twilio_sid: twilioSid,
      error_message: errorMessage,
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error("Failed to log SMS:", logError);
    }

    return new Response(
      JSON.stringify({ success: status === "sent", status, twilioSid, message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("send-customer-worker-sms error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
