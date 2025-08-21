import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomerEmailRequest {
  bookingId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Proxy function: send-customer-booking-confirmation-email');
    console.log('Forwarding to: send-customer-booking-confirmation');

    const body = await req.text();
    console.log('Request body:', body);

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Forward to the actual implementation
    const { data, error } = await supabase.functions.invoke('send-customer-booking-confirmation', {
      body: JSON.parse(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (error) {
      console.error('Error forwarding to send-customer-booking-confirmation:', error);
      throw error;
    }

    console.log('Successfully forwarded to send-customer-booking-confirmation');
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Proxy error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Proxy function failed', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);