import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const { booking_id, services, testing_mode = false } = await req.json();

    console.log('[ADD-BOOKING-SERVICES] Request:', { booking_id, services: services.length });

    // Get booking details including saved payment method
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, booking_services(*)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // CRITICAL FIX: Block adding services to already captured bookings
    if (booking.payment_status === 'captured') {
      throw new Error('Cannot add services to a booking that has already been charged. Please create a new booking for additional services.');
    }

    if (!booking.payment_intent_id) {
      throw new Error('Booking has no payment intent');
    }

    // Calculate current total
    const currentTotal = booking.booking_services?.reduce((sum: number, bs: any) => 
      sum + (bs.base_price * bs.quantity), 0
    ) || 0;

    // Calculate new services total
    const newServicesTotal = services.reduce((sum: number, s: any) => 
      sum + (s.price * s.quantity), 0
    );

    const newTotal = currentTotal + newServicesTotal;
    const newTotalCents = Math.round(newTotal * 100);

    console.log('[ADD-BOOKING-SERVICES] Totals:', {
      current: currentTotal,
      new_services: newServicesTotal,
      new_total: newTotal,
      has_saved_payment: !!(booking.stripe_customer_id && booking.stripe_payment_method_id)
    });

    // Insert services into booking_services table
    const servicesData = services.map((s: any) => ({
      booking_id,
      service_id: s.id,
      service_name: s.name,
      base_price: s.price,
      quantity: s.quantity,
      configuration: s.configuration || {}
    }));

    const { data: insertedServices, error: insertError } = await supabase
      .from('booking_services')
      .insert(servicesData)
      .select('id');

    if (insertError) {
      console.error('[ADD-BOOKING-SERVICES] Insert error:', insertError);
      throw new Error('Failed to add services to booking');
    }

    // Store inserted IDs for potential rollback
    const insertedServiceIds = insertedServices?.map(s => s.id) || [];

    // Check if booking has saved payment method for seamless reauthorization
    const hasPaymentMethod = booking.stripe_customer_id && booking.stripe_payment_method_id;

    if (hasPaymentMethod) {
      // SEAMLESS REAUTHORIZATION: Use saved payment method to create new PaymentIntent
      try {
        console.log('[ADD-BOOKING-SERVICES] Creating new PaymentIntent with saved payment method');
        
        // Create new PaymentIntent with saved payment method (auto-confirm)
        const newPaymentIntent = await stripe.paymentIntents.create({
          amount: newTotalCents,
          currency: 'usd',
          customer: booking.stripe_customer_id,
          payment_method: booking.stripe_payment_method_id,
          capture_method: 'manual',
          confirm: true,
          off_session: true,
          metadata: {
            booking_id,
            original_payment_intent: booking.payment_intent_id,
            reason: 'service_addition'
          }
        });

        console.log('[ADD-BOOKING-SERVICES] New PaymentIntent created:', {
          id: newPaymentIntent.id,
          status: newPaymentIntent.status,
          amount: newPaymentIntent.amount
        });

        if (newPaymentIntent.status === 'requires_capture') {
          // Cancel old PaymentIntent to release the hold
          try {
            console.log('[ADD-BOOKING-SERVICES] Canceling old PaymentIntent:', booking.payment_intent_id);
            await stripe.paymentIntents.cancel(booking.payment_intent_id);
          } catch (cancelError: any) {
            // Log but don't fail - old PI might already be canceled or in wrong state
            console.warn('[ADD-BOOKING-SERVICES] Could not cancel old PaymentIntent:', cancelError.message);
          }

          // Update booking with new payment_intent_id
          await supabase
            .from('bookings')
            .update({ 
              payment_intent_id: newPaymentIntent.id,
              pending_payment_amount: newTotal,
              payment_status: 'authorized'
            })
            .eq('id', booking_id);

          // Update existing authorization transaction with new PaymentIntent
          const { error: txUpdateError } = await supabase
            .from('transactions')
            .update({
              payment_intent_id: newPaymentIntent.id,
              amount: newTotal,
              base_amount: newTotal
            })
            .eq('booking_id', booking_id)
            .eq('status', 'authorized');

          if (txUpdateError) {
            console.warn('[ADD-BOOKING-SERVICES] Transaction update warning:', txUpdateError);
            // Create new transaction if update failed
            await supabase
              .from('transactions')
              .insert({
                booking_id,
                amount: newTotal,
                base_amount: newTotal,
                status: 'authorized',
                payment_intent_id: newPaymentIntent.id,
                transaction_type: 'authorization',
                payment_method: 'card'
              });
          }

          // Log audit entry
          await supabase
            .from('booking_audit_log')
            .insert({
              booking_id,
              operation: 'authorization_updated',
              status: 'success',
              payment_intent_id: newPaymentIntent.id,
              details: {
                old_amount: currentTotal,
                new_amount: newTotal,
                old_payment_intent: booking.payment_intent_id,
                new_payment_intent: newPaymentIntent.id,
                services_added: services.length
              }
            });

          console.log('[ADD-BOOKING-SERVICES] Authorization updated successfully');

          // Update invoice
          try {
            console.log('[ADD-BOOKING-SERVICES] Updating invoice...');
            await supabase.functions.invoke('update-invoice', {
              body: {
                booking_id,
                send_email: false
              }
            });
            console.log('[ADD-BOOKING-SERVICES] Invoice updated successfully');
          } catch (invoiceError) {
            console.error('[ADD-BOOKING-SERVICES] Invoice update failed:', invoiceError);
          }

          // Send notification email
          try {
            await supabase.functions.invoke('send-increment-notification', {
              body: { 
                booking_id,
                original_amount: currentTotal,
                added_amount: newServicesTotal,
                new_total: newTotal
              }
            });
          } catch (emailError) {
            console.error('[ADD-BOOKING-SERVICES] Email notification failed:', emailError);
          }

          return new Response(
            JSON.stringify({
              success: true,
              incremented: true,
              new_amount: newTotal,
              services_added: services.length,
              payment_intent_id: newPaymentIntent.id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } else if (newPaymentIntent.status === 'requires_action' || newPaymentIntent.status === 'requires_confirmation') {
          // Card requires 3DS authentication - return client_secret for frontend
          console.log('[ADD-BOOKING-SERVICES] Payment requires customer authentication');
          
          return new Response(
            JSON.stringify({
              success: true,
              incremented: false,
              requires_action: true,
              client_secret: newPaymentIntent.client_secret,
              new_amount: newTotal,
              new_payment_intent: newPaymentIntent.id,
              old_payment_intent: booking.payment_intent_id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          throw new Error(`Unexpected PaymentIntent status: ${newPaymentIntent.status}`);
        }

      } catch (paymentError: any) {
        console.error('[ADD-BOOKING-SERVICES] Payment reauthorization failed:', paymentError.message);
        
        // Check if it's a card decline or authentication required
        if (paymentError.code === 'authentication_required' || 
            paymentError.code === 'card_declined' ||
            paymentError.type === 'StripeCardError') {
          
          // Rollback services since payment failed
          if (insertedServiceIds.length > 0) {
            await supabase
              .from('booking_services')
              .delete()
              .in('id', insertedServiceIds);
          }
          
          // Create new PaymentIntent without auto-confirm for manual payment
          const manualPaymentIntent = await stripe.paymentIntents.create({
            amount: newTotalCents,
            currency: 'usd',
            customer: booking.stripe_customer_id,
            capture_method: 'manual',
            metadata: {
              booking_id,
              original_payment_intent: booking.payment_intent_id,
              reason: 'reauthorization_required'
            }
          });

          return new Response(
            JSON.stringify({
              success: true,
              incremented: false,
              requires_new_payment: true,
              client_secret: manualPaymentIntent.client_secret,
              new_amount: newTotal,
              old_payment_intent: booking.payment_intent_id,
              new_payment_intent: manualPaymentIntent.id,
              message: 'Card requires re-authentication. Please complete payment.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // For other errors, rollback and throw
        if (insertedServiceIds.length > 0) {
          await supabase
            .from('booking_services')
            .delete()
            .in('id', insertedServiceIds);
        }
        
        throw new Error(`Payment authorization failed: ${paymentError.message}`);
      }

    } else {
      // NO SAVED PAYMENT METHOD: Create new PaymentIntent for manual payment
      console.log('[ADD-BOOKING-SERVICES] No saved payment method - creating new PaymentIntent for manual payment');
      
      const newPaymentIntent = await stripe.paymentIntents.create({
        amount: newTotalCents,
        currency: 'usd',
        capture_method: 'manual',
        metadata: {
          booking_id,
          original_payment_intent: booking.payment_intent_id,
          reason: 'no_saved_payment_method'
        }
      });

      // Update booking pending amount (keep old payment_intent_id until new one is confirmed)
      await supabase
        .from('bookings')
        .update({ 
          pending_payment_amount: newTotal
        })
        .eq('id', booking_id);

      return new Response(
        JSON.stringify({
          success: true,
          incremented: false,
          requires_new_payment: true,
          client_secret: newPaymentIntent.client_secret,
          new_amount: newTotal,
          old_payment_intent: booking.payment_intent_id,
          new_payment_intent: newPaymentIntent.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('[ADD-BOOKING-SERVICES] Error:', error);
    
    // Provide specific error messages
    let errorMessage = 'Failed to add services';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.message?.includes('Booking not found')) {
      errorMessage = 'Booking not found. Please refresh the page and try again.';
      errorCode = 'BOOKING_NOT_FOUND';
    } else if (error.message?.includes('no payment intent')) {
      errorMessage = 'No payment method on file. Please contact support.';
      errorCode = 'NO_PAYMENT_INTENT';
    } else if (error.message?.includes('Payment authorization failed')) {
      errorMessage = 'Payment authorization failed. Please check your payment method and try again.';
      errorCode = 'PAYMENT_AUTH_FAILED';
    } else if (error.message?.includes('already been charged')) {
      errorMessage = error.message;
      errorCode = 'ALREADY_CAPTURED';
    } else if (error.message?.includes('Stripe')) {
      errorMessage = 'Payment processing error. Please try again or contact support.';
      errorCode = 'STRIPE_ERROR';
    } else if (error.message?.includes('duplicate')) {
      errorMessage = 'One or more services have already been added to this booking.';
      errorCode = 'DUPLICATE_SERVICE';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        error_code: errorCode,
        details: error.message
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
