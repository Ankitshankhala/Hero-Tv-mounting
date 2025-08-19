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

    const url = new URL(req.url);
    const includeHidden = url.searchParams.get('include_hidden') === 'true';

    // Get all bookings for this worker
    let query = supabaseClient
      .from('bookings')
      .select(`
        *,
        booking_services(*),
        transactions(*),
        worker_booking_preferences!left(is_hidden, hidden_at)
      `)
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false });

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    // Filter out hidden bookings unless explicitly requested
    let filteredBookings = bookings || [];
    
    if (!includeHidden) {
      filteredBookings = bookings?.filter(booking => {
        // If no preference record exists, show the booking
        // If preference exists and is_hidden is true, hide it
        return !booking.worker_booking_preferences?.some(pref => pref.is_hidden);
      }) || [];
    }

    // Calculate totals for each booking
    const enrichedBookings = filteredBookings.map(booking => {
      const totalServicePrice = booking.booking_services?.reduce((sum, service) => {
        return sum + (service.base_price * service.quantity);
      }, 0) || 0;

      const latestTransaction = booking.transactions?.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      return {
        ...booking,
        total_service_price: totalServicePrice,
        latest_transaction: latestTransaction,
        is_hidden: booking.worker_booking_preferences?.some(pref => pref.is_hidden) || false
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        bookings: enrichedBookings,
        total_count: enrichedBookings.length,
        hidden_count: (bookings || []).filter(b => 
          b.worker_booking_preferences?.some(pref => pref.is_hidden)
        ).length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[LIST-WORKER-BOOKINGS] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to fetch worker bookings"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});