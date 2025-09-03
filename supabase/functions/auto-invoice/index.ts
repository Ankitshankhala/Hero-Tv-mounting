
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type: string;
  table: string;
  record: any;
  old_record?: any;
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

    const payload: WebhookPayload = await req.json();
    console.log('Auto-invoice webhook received:', payload);
    
    // Only process booking status updates to 'completed' or transaction status to 'completed'
    if (payload.table === 'bookings' && payload.type === 'UPDATE') {
      const booking = payload.record;
      const oldBooking = payload.old_record;
      
      // Check if booking status changed to completed
      if (booking.status === 'completed' && oldBooking?.status !== 'completed') {
        console.log(`Booking ${booking.id} completed, generating invoice...`);
        
        // Check for existing invoice to prevent duplicates
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id, invoice_number, delivery_status')
          .eq('booking_id', booking.id)
          .maybeSingle();

        if (existingInvoice) {
          console.log(`Invoice already exists for booking ${booking.id}: ${existingInvoice.invoice_number}`);
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Invoice already exists',
            invoice_id: existingInvoice.id 
          }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        // Call enhanced-invoice-generator function
        const invoiceResponse = await supabase.functions.invoke('enhanced-invoice-generator', {
          body: {
            booking_id: booking.id,
            trigger_source: 'booking_completed',
            send_email: true
          }
        });
        
        if (invoiceResponse.error) {
          console.error('Failed to generate invoice:', invoiceResponse.error);
        } else {
          console.log('Invoice generated successfully for booking:', booking.id);
        }
      }
    }
    
    if (payload.table === 'transactions' && payload.type === 'UPDATE') {
      const transaction = payload.record;
      const oldTransaction = payload.old_record;
      
      // Check if transaction status changed to completed
      if (transaction.status === 'completed' && oldTransaction?.status !== 'completed') {
        console.log(`Transaction ${transaction.id} completed, generating invoice...`);
        
        // Call enhanced-invoice-generator function
        const invoiceResponse = await supabase.functions.invoke('enhanced-invoice-generator', {
          body: {
            booking_id: transaction.booking_id,
            transaction_id: transaction.id,
            trigger_source: 'payment_capture',
            send_email: true
          }
        });
        
        if (invoiceResponse.error) {
          console.error('Failed to generate invoice:', invoiceResponse.error);
        } else {
          console.log('Invoice generated successfully for transaction:', transaction.id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in auto-invoice function:", error);
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
