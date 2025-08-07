import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyEmailRequest {
  booking_ids: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { booking_ids }: VerifyEmailRequest = await req.json();
    
    console.log(`Verifying email addresses for bookings: ${booking_ids.join(', ')}`);

    const emailVerifications = [];

    for (const booking_id of booking_ids) {
      try {
        // Fetch booking details with customer information
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            id,
            customer_id,
            guest_customer_info,
            scheduled_date,
            status,
            customer:users!bookings_customer_id_fkey(id, name, email, phone),
            service:services(id, name)
          `)
          .eq('id', booking_id)
          .single();

        if (bookingError || !booking) {
          emailVerifications.push({
            booking_id,
            success: false,
            error: `Booking not found: ${bookingError?.message}`,
            email_address: null,
            customer_name: null,
            customer_type: null
          });
          continue;
        }

        // Determine email address and customer info
        let customerEmail = null;
        let customerName = null;
        let customerType = null;

        if (booking.customer_id && booking.customer) {
          // Registered customer
          customerEmail = booking.customer.email;
          customerName = booking.customer.name;
          customerType = 'registered';
        } else if (booking.guest_customer_info) {
          // Guest customer
          customerEmail = booking.guest_customer_info.email;
          customerName = booking.guest_customer_info.name;
          customerType = 'guest';
        }

        console.log(`Booking ${booking_id}: Email will be sent to ${customerEmail} (${customerName}) - ${customerType} customer`);

        emailVerifications.push({
          booking_id,
          success: !!customerEmail,
          email_address: customerEmail,
          customer_name: customerName,
          customer_type: customerType,
          service_name: booking.service?.name,
          scheduled_date: booking.scheduled_date,
          booking_status: booking.status,
          error: customerEmail ? null : 'No email address found for customer'
        });

      } catch (error) {
        console.error(`Error verifying email for booking ${booking_id}:`, error);
        emailVerifications.push({
          booking_id,
          success: false,
          error: error.message,
          email_address: null,
          customer_name: null,
          customer_type: null
        });
      }
    }

    // Log summary
    const successCount = emailVerifications.filter(v => v.success).length;
    const failureCount = emailVerifications.filter(v => !v.success).length;
    
    console.log(`Email verification complete: ${successCount} valid, ${failureCount} invalid`);

    return new Response(JSON.stringify({
      success: true,
      verified_count: successCount,
      failed_count: failureCount,
      verifications: emailVerifications
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("Error in verify-invoice-emails function:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);