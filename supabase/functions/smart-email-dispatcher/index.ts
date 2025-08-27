import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailDispatchRequest {
  bookingId: string;
  workerId?: string;
  emailType: 'worker_assignment' | 'customer_confirmation';
  source: 'auto_trigger' | 'manual';
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Smart email dispatcher triggered');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: EmailDispatchRequest = await req.json();
    console.log('Email dispatch request:', requestData);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    if (requestData.emailType === 'worker_assignment' && requestData.workerId) {
      // Delegate worker assignment emails to specialized function
      console.log('[EMAIL-DISPATCHER] Delegating to send-worker-assignment-notification');
      
      const { data: assignmentResult, error: assignmentError } = await supabase.functions.invoke(
        'send-worker-assignment-notification',
        {
          body: {
            bookingId: requestData.bookingId,
            workerId: requestData.workerId,
            force: false,
            source: 'smart_email_dispatcher'
          }
        }
      );

      if (assignmentError) {
        console.error('[EMAIL-DISPATCHER] Worker assignment delegation failed:', assignmentError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to send worker assignment email',
          details: assignmentError.message
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.log('[EMAIL-DISPATCHER] Worker assignment delegated successfully:', assignmentResult);
      return new Response(JSON.stringify({
        success: true,
        ...assignmentResult,
        source: 'delegated_to_specialized_function'
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    } else if (requestData.emailType === 'customer_confirmation') {
      // Forward to customer confirmation function
      console.log('Forwarding customer confirmation to dedicated function');
      
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-customer-booking-confirmation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ bookingId: requestData.bookingId })
        }
      );

      const result = await response.json();
      
      return new Response(JSON.stringify(result), {
        status: response.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    throw new Error('Invalid email type or missing required parameters');

  } catch (error: any) {
    console.error("Error in smart email dispatcher:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Email dispatch failed' 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);