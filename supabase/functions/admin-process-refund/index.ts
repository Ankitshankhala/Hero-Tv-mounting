import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

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

    // Authenticate admin user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Verify user is admin
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'admin') {
      throw new Error("Unauthorized: Admin access required");
    }

    const { booking_id, refund_amount, reason, notify_customer = true } = await req.json();

    if (!booking_id) {
      throw new Error("Booking ID is required");
    }

    if (!reason || reason.length < 10) {
      throw new Error("Refund reason must be at least 10 characters");
    }

    console.log(`[ADMIN-REFUND] Processing refund for booking: ${booking_id}`);

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        users!bookings_customer_id_fkey(email, name)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === 'cancelled') {
      throw new Error("Booking is already cancelled");
    }

    if (!booking.payment_intent_id) {
      throw new Error("No payment intent found for this booking");
    }

    // Check for existing refund to prevent duplicates (idempotency)
    const { data: existingRefund } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('transaction_type', 'refund')
      .single();

    if (existingRefund) {
      throw new Error("This booking has already been refunded");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    let refundResult = null;
    let cancellationType = '';
    let actualRefundAmount = 0;

    // Get payment intent status
    const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
    
    if (paymentIntent.status === 'succeeded') {
      // Payment was captured - process refund
      const maxRefundAmount = paymentIntent.amount / 100;
      const refundAmountToProcess = refund_amount || maxRefundAmount;

      if (refundAmountToProcess > maxRefundAmount) {
        throw new Error(`Refund amount ($${refundAmountToProcess}) cannot exceed captured amount ($${maxRefundAmount})`);
      }

      refundResult = await stripe.refunds.create({
        payment_intent: booking.payment_intent_id,
        amount: Math.round(refundAmountToProcess * 100),
        reason: 'requested_by_customer',
        metadata: {
          booking_id: booking_id,
          refunded_by: user.id,
          refund_reason: reason,
          refund_type: refund_amount ? 'partial' : 'full'
        }
      });

      actualRefundAmount = refundResult.amount / 100;
      cancellationType = refund_amount ? 'partial_refund' : 'full_refund';
      
      console.log(`[ADMIN-REFUND] Refund created: ${refundResult.id} for amount: $${actualRefundAmount}`);

    } else if (paymentIntent.status === 'requires_capture') {
      // Payment was only authorized - cancel authorization
      await stripe.paymentIntents.cancel(booking.payment_intent_id);
      actualRefundAmount = paymentIntent.amount / 100;
      cancellationType = 'authorization_cancelled';
      
      console.log(`[ADMIN-REFUND] Authorization cancelled: ${booking.payment_intent_id}`);
    } else {
      throw new Error(`Cannot refund payment with status: ${paymentIntent.status}`);
    }

    // Use service role client for transaction insertion
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create transaction record
    const { error: transactionError } = await supabaseService
      .from('transactions')
      .insert({
        booking_id: booking_id,
        payment_intent_id: booking.payment_intent_id,
        amount: -actualRefundAmount, // Negative for refund
        transaction_type: 'refund',
        status: 'completed',
        stripe_refund_id: refundResult?.id || null,
        cancellation_reason: reason,
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString()
      });

    if (transactionError) {
      console.error('[ADMIN-REFUND] Failed to create transaction record:', transactionError);
    }

    // Update booking status
    const isFullRefund = !refund_amount || refund_amount >= (paymentIntent.amount / 100);
    
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        payment_status: isFullRefund ? 'refunded' : 'partial_refund',
        status: isFullRefund ? 'cancelled' : booking.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', booking_id);

    if (updateError) {
      console.error('[ADMIN-REFUND] Failed to update booking:', updateError);
    }

    // Send customer notification if requested
    if (notify_customer) {
      try {
        const customerEmail = booking.users?.email || booking.guest_customer_info?.email;
        
        if (customerEmail) {
          await supabaseClient.functions.invoke('unified-email-dispatcher', {
            body: {
              bookingId: booking_id,
              recipientEmail: customerEmail,
              emailType: 'booking_cancelled',
              additionalData: {
                refund_amount: actualRefundAmount,
                refund_reason: reason,
                refund_type: isFullRefund ? 'full' : 'partial'
              }
            }
          });
          
          console.log(`[ADMIN-REFUND] Customer notification sent to: ${customerEmail}`);
        }
      } catch (emailError) {
        console.error('[ADMIN-REFUND] Email notification failed:', emailError);
        // Don't fail the whole operation for email issues
      }
    }

    // Log the refund action
    await supabaseClient.from('sms_logs').insert({
      booking_id: booking_id,
      recipient_number: 'system',
      message: `Admin refund processed: $${actualRefundAmount} - ${reason}`,
      status: 'sent'
    });

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refundResult?.id || booking.payment_intent_id,
        refund_amount: actualRefundAmount,
        refund_type: isFullRefund ? 'full' : 'partial',
        cancellation_type: cancellationType,
        message: `Successfully processed ${isFullRefund ? 'full' : 'partial'} refund of $${actualRefundAmount}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to process refund";
    console.error("[ADMIN-REFUND] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});
