import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Confirm Payment Endpoint
 * Called after payment authorization to:
 * 1. Update booking status to 'confirmed'
 * 2. Update transaction status to 'authorized'
 * 3. Generate draft invoice
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { booking_id, payment_intent_id } = await req.json();

    console.log('[CONFIRM-PAYMENT] Starting confirmation for:', { booking_id, payment_intent_id });

    if (!booking_id) {
      throw new Error('Missing booking_id');
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, payment_status, payment_intent_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('[CONFIRM-PAYMENT] Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    console.log('[CONFIRM-PAYMENT] Current booking state:', {
      status: booking.status,
      payment_status: booking.payment_status
    });

    // Update booking status to confirmed
    const { error: updateBookingError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: 'authorized',
        updated_at: new Date().toISOString()
      })
      .eq('id', booking_id);

    if (updateBookingError) {
      console.error('[CONFIRM-PAYMENT] Failed to update booking:', updateBookingError);
      throw new Error('Failed to update booking status');
    }

    // Update transaction status if payment_intent_id provided
    const intentId = payment_intent_id || booking.payment_intent_id;
    if (intentId) {
      const { error: updateTxError } = await supabase
        .from('transactions')
        .update({
          status: 'authorized'
        })
        .eq('booking_id', booking_id)
        .eq('payment_intent_id', intentId)
        .eq('status', 'pending');

      if (updateTxError) {
        console.error('[CONFIRM-PAYMENT] Failed to update transaction:', updateTxError);
        // Don't throw - transaction might already be authorized
      }
    }

    // Generate draft invoice (non-blocking)
    let invoiceResult = null;
    try {
      console.log('[CONFIRM-PAYMENT] Generating draft invoice...');
      const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke('generate-invoice', {
        body: {
          booking_id: booking_id,
          send_email: false  // Don't email draft invoices
        }
      });

      if (invoiceError) {
        console.error('[CONFIRM-PAYMENT] Invoice generation failed:', invoiceError);
      } else {
        invoiceResult = invoiceData;
        console.log('[CONFIRM-PAYMENT] Draft invoice generated:', invoiceData?.invoice?.invoice_number);
      }
    } catch (invoiceErr) {
      console.error('[CONFIRM-PAYMENT] Invoice generation error:', invoiceErr);
      // Don't fail the whole operation if invoice generation fails
    }

    // Log the confirmation
    await supabase.from('booking_audit_log').insert({
      booking_id: booking_id,
      operation: 'payment_confirmed',
      status: 'success',
      payment_intent_id: intentId,
      details: {
        previous_status: booking.status,
        new_status: 'confirmed',
        invoice_generated: !!invoiceResult
      }
    });

    console.log('[CONFIRM-PAYMENT] Payment confirmed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: booking_id,
        status: 'confirmed',
        payment_status: 'authorized',
        invoice: invoiceResult?.invoice || null,
        message: 'Payment confirmed and draft invoice generated'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CONFIRM-PAYMENT] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Payment confirmation failed'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
