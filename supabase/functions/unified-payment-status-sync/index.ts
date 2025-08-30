import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNIFIED-PAYMENT-SYNC] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting unified payment status synchronization');
    
    const { payment_intent_id, booking_id, transaction_status, force_sync = false } = await req.json();
    
    if (!payment_intent_id && !booking_id) {
      throw new Error('Either payment_intent_id or booking_id is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Input validation passed', { payment_intent_id, booking_id, transaction_status, force_sync });

    // Step 1: Find related records
    let booking = null;
    let transaction = null;

    if (payment_intent_id) {
      // Find transaction by payment intent
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('id, booking_id, status, amount, payment_intent_id')
        .eq('payment_intent_id', payment_intent_id)
        .single();

      if (transactionError) {
        throw new Error(`Transaction not found: ${transactionError.message}`);
      }

      transaction = transactionData;
      
      if (transaction.booking_id) {
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select('id, status, payment_status, payment_intent_id')
          .eq('id', transaction.booking_id)
          .single();

        if (!bookingError) {
          booking = bookingData;
        }
      }
    } else if (booking_id) {
      // Find booking and related transaction
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('id, status, payment_status, payment_intent_id')
        .eq('id', booking_id)
        .single();

      if (bookingError) {
        throw new Error(`Booking not found: ${bookingError.message}`);
      }

      booking = bookingData;

      if (booking.payment_intent_id) {
        const { data: transactionData, error: transactionError } = await supabase
          .from('transactions')
          .select('id, booking_id, status, amount, payment_intent_id')
          .eq('payment_intent_id', booking.payment_intent_id)
          .single();

        if (!transactionError) {
          transaction = transactionData;
        }
      }
    }

    logStep('Records found', { 
      hasBooking: !!booking, 
      hasTransaction: !!transaction,
      bookingStatus: booking?.status,
      transactionStatus: transaction?.status 
    });

    // Step 2: Determine target status using enum-safe normalization
    let targetTransactionStatus = transaction_status || transaction?.status;
    let targetBookingStatus = null;
    let targetPaymentStatus = null;

    // Normalize transaction status to enum-safe values
    const ensureSafeTransactionStatus = (status: string): string => {
      const normalizedStatus = String(status).toLowerCase().trim();
      
      switch (normalizedStatus) {
        case 'requires_payment_method':
        case 'requires_confirmation':
        case 'requires_action':
        case 'processing':
        case 'pending':
          return 'pending';
        case 'requires_capture':
        case 'authorized':
        case 'payment_authorized':
          return 'authorized';
        case 'succeeded':
        case 'completed':
          return 'completed';
        case 'captured':
          return 'completed'; // Normalize captured to completed for transaction status
        case 'canceled':
        case 'cancelled':
        case 'failed':
        case 'payment_failed':
        default:
          return 'failed';
      }
    };

    if (targetTransactionStatus) {
      // Normalize transaction status first
      targetTransactionStatus = ensureSafeTransactionStatus(targetTransactionStatus);
      
      // Map normalized transaction status to booking status
      switch (targetTransactionStatus) {
        case 'authorized':
          targetBookingStatus = 'payment_authorized';
          targetPaymentStatus = 'authorized';
          break;
        case 'completed':
          targetBookingStatus = 'confirmed';
          targetPaymentStatus = 'completed';
          break;
        case 'failed':
          targetBookingStatus = 'failed';
          targetPaymentStatus = 'failed';
          break;
        case 'pending':
        default:
          targetBookingStatus = 'payment_pending';
          targetPaymentStatus = 'pending';
          break;
      }
    }

    logStep('Target statuses determined', { 
      targetTransactionStatus, 
      targetBookingStatus, 
      targetPaymentStatus 
    });

    // Step 3: Update transaction if needed
    let transactionUpdated = false;
    if (transaction && targetTransactionStatus && transaction.status !== targetTransactionStatus) {
      const { error: transactionUpdateError } = await supabase
        .from('transactions')
        .update({ status: targetTransactionStatus })
        .eq('id', transaction.id);

      if (transactionUpdateError) {
        logStep('Transaction update failed', { error: transactionUpdateError });
      } else {
        transactionUpdated = true;
        logStep('Transaction status updated', { 
          transactionId: transaction.id, 
          newStatus: targetTransactionStatus 
        });
      }
    }

    // Step 4: Update booking if needed
    let bookingUpdated = false;
    if (booking && targetBookingStatus && targetPaymentStatus) {
      const needsUpdate = force_sync || 
        booking.status !== targetBookingStatus || 
        booking.payment_status !== targetPaymentStatus;

      if (needsUpdate) {
        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({ 
            status: targetBookingStatus,
            payment_status: targetPaymentStatus
          })
          .eq('id', booking.id);

        if (bookingUpdateError) {
          logStep('Booking update failed', { error: bookingUpdateError });
        } else {
          bookingUpdated = true;
          logStep('Booking status updated', { 
            bookingId: booking.id, 
            newStatus: targetBookingStatus,
            newPaymentStatus: targetPaymentStatus
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      booking_updated: bookingUpdated,
      transaction_updated: transactionUpdated,
      booking_status: targetBookingStatus,
      payment_status: targetPaymentStatus,
      transaction_status: targetTransactionStatus
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error in unified payment status sync', { error: error.message });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});