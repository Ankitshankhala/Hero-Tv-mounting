import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bookingId, recipientEmail, emailType, workerData } = await req.json();
    
    console.log(`[UNIFIED-EMAIL-DISPATCHER] Processing: ${emailType} for ${recipientEmail}`, 
      workerData ? `(with pre-resolved worker: ${workerData.name})` : '(no workerData passed)');

    // Validate required parameters
    if (!bookingId || !recipientEmail || !emailType) {
      throw new Error('bookingId, recipientEmail, and emailType are required');
    }

    // Check if email already sent (idempotency)
    const { data: existingLog } = await supabase
      .from('email_logs')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('recipient_email', recipientEmail)
      .eq('email_type', emailType)
      .eq('status', 'sent')
      .maybeSingle();

    if (existingLog) {
      console.log('[UNIFIED-EMAIL-DISPATCHER] Email already sent, returning cached');
      return new Response(
        JSON.stringify({ success: true, message: 'Email already sent', cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to appropriate email handler
    let emailResponse;
    
    switch (emailType) {
      case 'worker_assignment':
        // For worker assignment, we need to get the workerId from the booking
        const { data: booking } = await supabase
          .from('bookings')
          .select('worker_id')
          .eq('id', bookingId)
          .single();
        
        if (!booking?.worker_id) {
          throw new Error('Booking has no assigned worker');
        }
        
        emailResponse = await supabase.functions.invoke('send-worker-assignment-notification', {
          body: { bookingId, workerId: booking.worker_id }
        });
        break;
        
      case 'booking_confirmation':
      case 'customer_booking_confirmation': // Support both naming conventions
        emailResponse = await supabase.functions.invoke('send-customer-booking-confirmation-email', {
          body: { 
            bookingId,
            workerData  // Forward pre-resolved worker data (may be undefined for legacy calls)
          }
        });
        break;
        
      case 'increment_notification':
        emailResponse = await supabase.functions.invoke('send-increment-notification', {
          body: { booking_id: bookingId }
        });
        break;

      case 'invoice':
        emailResponse = await supabase.functions.invoke('send-invoice-email', {
          body: { 
            booking_id: bookingId,
            recipient_email: recipientEmail
          }
        });
        break;

      case 'invoice_updated':
        emailResponse = await supabase.functions.invoke('send-invoice-email', {
          body: { 
            booking_id: bookingId,
            recipient_email: recipientEmail
          }
        });
        break;
        
      default:
        throw new Error(`Unknown email type: ${emailType}`);
    }

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message);
    }

    console.log(`[UNIFIED-EMAIL-DISPATCHER] Email dispatched successfully: ${emailType}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailType,
        message: 'Email dispatched successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[UNIFIED-EMAIL-DISPATCHER] Error: ${errorMessage}`);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});