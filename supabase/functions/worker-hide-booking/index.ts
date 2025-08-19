import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { booking_id, is_hidden = true } = await req.json();

    if (!booking_id) {
      throw new Error("Booking ID is required");
    }

    // Verify worker has access to this booking
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, worker_id')
      .eq('id', booking_id)
      .eq('worker_id', user.id)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found or access denied");
    }

    // Insert or update worker booking preference
    const { error: upsertError } = await supabaseClient
      .from('worker_booking_preferences')
      .upsert({
        worker_id: user.id,
        booking_id: booking_id,
        is_hidden: is_hidden,
        hidden_at: is_hidden ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'worker_id,booking_id'
      });

    if (upsertError) {
      throw new Error(`Failed to update booking preference: ${upsertError.message}`);
    }

    // Log the action
    await supabaseClient.from('sms_logs').insert({
      booking_id: booking_id,
      recipient_number: 'system',
      message: `Booking ${is_hidden ? 'hidden' : 'unhidden'} by worker`,
      status: 'sent'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Booking ${is_hidden ? 'hidden' : 'restored'} successfully`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[WORKER-HIDE] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to update booking visibility"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});