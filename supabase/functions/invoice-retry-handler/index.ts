import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RetryRequest {
  invoice_id?: string;
  booking_id?: string;
  max_retries?: number;
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

    const { invoice_id, booking_id, max_retries = 3 }: RetryRequest = await req.json();

    if (!invoice_id && !booking_id) {
      throw new Error('Either invoice_id or booking_id is required');
    }

    // Find failed invoices to retry
    let query = supabase
      .from('invoices')
      .select('*')
      .eq('delivery_status', 'failed')
      .lt('delivery_attempts', max_retries);

    if (invoice_id) {
      query = query.eq('id', invoice_id);
    } else if (booking_id) {
      query = query.eq('booking_id', booking_id);
    }

    const { data: failedInvoices, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    if (!failedInvoices?.length) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No invoices found for retry',
        retried_count: 0 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let successCount = 0;
    let failCount = 0;

    for (const invoice of failedInvoices) {
      try {
        console.log(`Retrying invoice delivery for invoice ${invoice.id}`);
        
        // Call enhanced invoice generator with retry flag
        const retryResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enhanced-invoice-generator`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking_id: invoice.booking_id,
            send_email: true,
            trigger_source: 'retry'
          })
        });

        if (retryResponse.ok) {
          successCount++;
          console.log(`Successfully retried invoice ${invoice.id}`);
        } else {
          failCount++;
          const errorText = await retryResponse.text();
          console.error(`Failed to retry invoice ${invoice.id}:`, errorText);
          
          // Update delivery attempts
          await supabase
            .from('invoices')
            .update({ 
              delivery_attempts: (invoice.delivery_attempts || 0) + 1,
              last_delivery_attempt: new Date().toISOString(),
              delivery_status: 'failed'
            })
            .eq('id', invoice.id);
        }
      } catch (retryError) {
        failCount++;
        console.error(`Error retrying invoice ${invoice.id}:`, retryError);
        
        // Update delivery attempts
        await supabase
          .from('invoices')
          .update({ 
            delivery_attempts: (invoice.delivery_attempts || 0) + 1,
            last_delivery_attempt: new Date().toISOString(),
            delivery_status: 'failed'
          })
          .eq('id', invoice.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Invoice retry completed`,
      total_invoices: failedInvoices.length,
      success_count: successCount,
      fail_count: failCount
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in invoice-retry-handler:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);