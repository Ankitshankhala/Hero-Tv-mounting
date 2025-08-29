import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddServiceRequest {
  booking_id: string;
  services: { service_id: string; quantity?: number }[];
  testing_mode?: boolean;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADD-BOOKING-SERVICES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id, services, testing_mode }: AddServiceRequest = await req.json();

    if (!booking_id || !Array.isArray(services) || services.length === 0) {
      return new Response(
        JSON.stringify({ error: 'booking_id and services are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logStep('Fetching booking with payment details', { booking_id });
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, payment_intent_id, payment_status')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    if (booking.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Cannot modify a completed booking' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!booking.payment_intent_id) {
      return new Response(
        JSON.stringify({ error: 'Booking has no payment intent for authorization updates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch service details for pricing
    const serviceIds = services.map((s) => s.service_id);
    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('id, name, description, base_price')
      .in('id', serviceIds);

    if (serviceError) {
      throw new Error(`Failed to fetch services: ${serviceError.message}`);
    }

    const servicesMap = new Map<string, typeof serviceData[number]>();
    for (const svc of serviceData ?? []) {
      servicesMap.set(svc.id, svc);
    }

    const bookingServices = services.map((svc, index) => {
      const details = servicesMap.get(svc.service_id);
      const effectivePrice = testing_mode ? (index + 1) : (details?.base_price || 0);
      return {
        booking_id,
        service_id: svc.service_id,
        service_name: details?.name || 'Service',
        quantity: svc.quantity || 1,
        base_price: effectivePrice,
        configuration: {},
      };
    });

    logStep('Inserting booking_services', { count: bookingServices.length });
    const { error: insertError } = await supabase
      .from('booking_services')
      .insert(bookingServices);

    if (insertError) {
      throw new Error(`Failed to insert booking services: ${insertError.message}`);
    }

    // Get or create invoice for the booking
    logStep('Fetching invoice for booking');
    let { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, amount, tax_amount, total_amount')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (invoiceError) {
      throw new Error(`Error fetching invoice: ${invoiceError.message}`);
    }

    // If no invoice exists, create one
    if (!invoice) {
      logStep('No invoice found, creating new invoice');
      
      // Fetch full booking details for invoice creation
      const { data: fullBooking, error: fullBookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(id, name, email, phone, city, zip_code),
          service:services(id, name, description, base_price)
        `)
        .eq('id', booking_id)
        .maybeSingle();

      if (fullBookingError || !fullBooking) {
        throw new Error(`Failed to fetch booking details: ${fullBookingError?.message}`);
      }

      // Generate invoice number
      const { data: invoiceNumber, error: invoiceNumberError } = await supabase
        .rpc('generate_invoice_number');

      if (invoiceNumberError) {
        throw new Error(`Failed to generate invoice number: ${invoiceNumberError.message}`);
      }

      // Get customer data - handle both authenticated users and guests
      const customerData = fullBooking.customer || fullBooking.guest_customer_info;
      const customerCity = customerData?.city || '';
      const customerState = getStateFromCity(customerCity);
      
      // Calculate invoice amounts with state sales tax
      const serviceAmount = fullBooking.service?.base_price || 0;
      const { data: taxRateData } = await supabase
        .rpc('get_tax_rate_by_state', { state_abbreviation: customerState });
      const taxRate = taxRateData || 0.0625; // Default to 6.25% if state not found
      const taxAmount = serviceAmount * taxRate;
      const totalAmount = serviceAmount + taxAmount;

      // Create invoice
      const { data: newInvoice, error: newInvoiceError } = await supabase
        .from('invoices')
        .insert({
          booking_id: booking_id,
          invoice_number: invoiceNumber,
          customer_id: fullBooking.customer_id,
          amount: serviceAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          state_code: customerState,
          tax_rate: taxRate,
          status: 'draft'
        })
        .select('id, amount, tax_amount, total_amount')
        .single();

      if (newInvoiceError) {
        throw new Error(`Failed to create invoice: ${newInvoiceError.message}`);
      }

      // Create initial invoice item for the original service
      const { error: originalItemError } = await supabase
        .from('invoice_items')
        .insert({
          invoice_id: newInvoice.id,
          service_name: fullBooking.service?.name || 'TV Mounting Service',
          description: fullBooking.service?.description || 'Professional TV mounting service',
          quantity: 1,
          unit_price: serviceAmount,
          total_price: serviceAmount
        });

      if (originalItemError) {
        logStep('Warning: Failed to create original invoice item', { error: originalItemError.message });
      }

      invoice = newInvoice;
      logStep('Invoice created successfully', { invoice_id: invoice.id });
    }

    const invoiceItems = bookingServices.map((svc) => {
      const description = testing_mode 
        ? `[TEST] ${servicesMap.get(svc.service_id)?.description || ''}`
        : servicesMap.get(svc.service_id)?.description || '';
      return {
        invoice_id: invoice.id,
        service_name: svc.service_name,
        description,
        quantity: svc.quantity,
        unit_price: svc.base_price,
        total_price: svc.base_price * (svc.quantity || 1),
      };
    });

    logStep('Inserting invoice_items', { count: invoiceItems.length });
    const { error: itemError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemError) {
      throw new Error(`Failed to insert invoice items: ${itemError.message}`);
    }

    const newAmount =
      Number(invoice.amount) + invoiceItems.reduce((sum, item) => sum + Number(item.total_price), 0);
    const newTotal = newAmount + Number(invoice.tax_amount);

    logStep('Updating invoice totals', { invoice_id: invoice.id, newAmount, newTotal });
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ amount: newAmount, total_amount: newTotal })
      .eq('id', invoice.id);

    if (updateError) {
      throw new Error(`Failed to update invoice totals: ${updateError.message}`);
    }

    // Initialize Stripe and update payment intent amount
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const additionalAmount = invoiceItems.reduce((sum, item) => sum + Number(item.total_price), 0);
    const additionalAmountCents = Math.round(additionalAmount * 100);

    logStep('Updating Stripe payment intent', { 
      payment_intent_id: booking.payment_intent_id, 
      additional_amount_cents: additionalAmountCents 
    });

    try {
      // Get current payment intent to check its status
      const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
      
      logStep('Current PaymentIntent status', { 
        status: paymentIntent.status, 
        amount: paymentIntent.amount 
      });

      // Option A: For requires_capture status, cancel original and create new PaymentIntent for total amount
      if (paymentIntent.status === 'requires_capture') {
        logStep('Implementing Option A: Cancel and recreate PaymentIntent for total amount', { 
          original_amount: paymentIntent.amount,
          additional_amount: additionalAmountCents 
        });

        // Get original amount from the existing PaymentIntent
        const originalAmountCents = paymentIntent.amount;
        const totalAmountCents = originalAmountCents + additionalAmountCents;

        // Get customer info for new PaymentIntent
        const { data: fullBooking } = await supabase
          .from('bookings')
          .select(`
            *,
            customer:users!bookings_customer_id_fkey(email),
            guest_customer_info
          `)
          .eq('id', booking_id)
          .maybeSingle();

        const customerEmail = fullBooking?.customer?.email || fullBooking?.guest_customer_info?.email;

        try {
          // Step 1: Cancel the original PaymentIntent
          logStep('Cancelling original PaymentIntent', { payment_intent_id: booking.payment_intent_id });
          await stripe.paymentIntents.cancel(booking.payment_intent_id);

          // Step 2: Mark original transaction as cancelled
          const { error: cancelTransactionError } = await supabase
            .from('transactions')
            .update({ status: 'cancelled' })
            .eq('payment_intent_id', booking.payment_intent_id);

          if (cancelTransactionError) {
            logStep('Warning: Failed to mark original transaction as cancelled', { error: cancelTransactionError.message });
          }

          // Step 3: Create new PaymentIntent for the total amount (original + additional)
          const newPaymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountCents,
            currency: 'usd',
            receipt_email: customerEmail,
            capture_method: 'automatic',
            confirm: false,
            description: `Complete service for booking ${booking_id} (original + additional services)`,
            metadata: {
              booking_id: booking_id,
              type: 'consolidated_payment',
              original_amount: originalAmountCents.toString(),
              additional_amount: additionalAmountCents.toString(),
              ...(testing_mode && { test_mode: 'true' })
            }
          });

          logStep('New consolidated PaymentIntent created', { 
            payment_intent_id: newPaymentIntent.id,
            total_amount: totalAmountCents,
            original_amount: originalAmountCents,
            additional_amount: additionalAmountCents
          });

          // Step 4: Create new transaction record for the consolidated payment
          const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
              booking_id,
              payment_intent_id: newPaymentIntent.id,
              amount: totalAmountCents / 100, // Convert back to dollars
              currency: 'USD',
              status: 'pending',
              transaction_type: 'charge',
            });

          if (transactionError) {
            logStep('Warning: Failed to create consolidated transaction record', { error: transactionError.message });
          }

          // Step 5: Update booking with new PaymentIntent ID
          const { error: bookingUpdateError } = await supabase
            .from('bookings')
            .update({ 
              payment_intent_id: newPaymentIntent.id,
              has_modifications: true,
              pending_payment_amount: null // Clear this since we have a new consolidated payment
            })
            .eq('id', booking_id);

          if (bookingUpdateError) {
            logStep('Warning: Failed to update booking with new PaymentIntent', { error: bookingUpdateError.message });
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              invoice_total: newTotal,
              total_amount: totalAmountCents / 100,
              original_amount: originalAmountCents / 100,
              additional_amount: additionalAmount,
              requires_inline_payment: true,
              client_secret: newPaymentIntent.client_secret,
              payment_intent_id: newPaymentIntent.id,
              message: 'Services added. Inline payment required for consolidated payment.'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (consolidationError) {
          logStep('Error during PaymentIntent consolidation, falling back to separate payment', { 
            error: consolidationError.message 
          });
          
          // If consolidation fails, fall back to creating separate payment for additional services
          const newPaymentIntent = await stripe.paymentIntents.create({
            amount: additionalAmountCents,
            currency: 'usd',
            receipt_email: customerEmail,
            capture_method: 'automatic',
            confirm: false,
            description: `Additional services for booking ${booking_id} (fallback)`,
            metadata: {
              booking_id: booking_id,
              type: 'additional_services_fallback',
              ...(testing_mode && { test_mode: 'true' })
            }
          });

          // Return PaymentIntent client_secret for inline payment
          logStep('Returning PaymentIntent for inline payment', { 
            payment_intent_id: newPaymentIntent.id,
            amount: additionalAmountCents
          });

          const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
              booking_id,
              payment_intent_id: newPaymentIntent.id,
              amount: additionalAmount,
              currency: 'USD',
              status: 'pending',
               transaction_type: 'charge',
            });

          if (transactionError) {
            logStep('Warning: Failed to create fallback transaction record', { error: transactionError.message });
          }

          const { error: bookingUpdateError } = await supabase
            .from('bookings')
            .update({ 
              has_modifications: true,
              pending_payment_amount: additionalAmount 
            })
            .eq('id', booking_id);

          if (bookingUpdateError) {
            logStep('Warning: Failed to update booking modifications flag', { error: bookingUpdateError.message });
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              invoice_total: newTotal,
              additional_amount: additionalAmount,
              requires_inline_payment: true,
              client_secret: newPaymentIntent.client_secret,
              payment_intent_id: newPaymentIntent.id,
              message: 'Services added. Inline payment required for additional services (fallback mode).'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // For other statuses, use the existing logic
      const canModifyAmount = ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status);

      if (canModifyAmount) {
        // Update existing payment intent amount and ensure automatic capture
        const newTotalCents = paymentIntent.amount + additionalAmountCents;
        const updatedPaymentIntent = await stripe.paymentIntents.update(booking.payment_intent_id, {
          amount: newTotalCents,
          capture_method: 'automatic',
        });

        logStep('Payment intent updated successfully', { 
          old_amount: paymentIntent.amount, 
          new_amount: newTotalCents 
        });

        // Create transaction record for the additional authorization
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            booking_id,
            payment_intent_id: booking.payment_intent_id,
            amount: additionalAmount,
            currency: 'USD',
            status: 'authorized',
             transaction_type: 'charge',
          });

        if (transactionError) {
          logStep('Warning: Failed to create transaction record', { error: transactionError.message });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            invoice_total: newTotal,
            additional_amount: additionalAmount,
            requires_additional_payment: true,
            payment_intent_client_secret: updatedPaymentIntent.client_secret,
            payment_intent_id: updatedPaymentIntent.id,
            payment_updated: true,
            message: 'Services added and payment authorization updated successfully'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } else {
        // PaymentIntent cannot be modified, create a new one for additional services
        logStep('Creating new PaymentIntent for additional services', { 
          reason: 'Original PaymentIntent cannot be modified',
          original_status: paymentIntent.status 
        });

        // Check if user has saved payment method for off-session charges
        let userWithSavedCard = null;
        if (booking.customer_id) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('stripe_customer_id, stripe_default_payment_method_id, has_saved_card')
            .eq('id', booking.customer_id)
            .single();

          if (!userError && userData?.has_saved_card && userData?.stripe_default_payment_method_id) {
            userWithSavedCard = userData;
            logStep('Found user with saved card for off-session payment');
          }
        }

        // Get customer info for new PaymentIntent
        const { data: fullBooking } = await supabase
          .from('bookings')
          .select(`
            *,
            customer:users!bookings_customer_id_fkey(email),
            guest_customer_info
          `)
          .eq('id', booking_id)
          .maybeSingle();

        const customerEmail = fullBooking?.customer?.email || fullBooking?.guest_customer_info?.email;

        // Create new PaymentIntent for additional services with card-on-file support
        const paymentIntentParams = {
          amount: additionalAmountCents,
          currency: 'usd',
          receipt_email: customerEmail,
          capture_method: 'manual', // Consistent with original booking flow
          description: `Additional services for booking ${booking_id}`,
          metadata: {
            booking_id: booking_id,
            type: 'additional_services'
          }
        };

        // Use saved payment method for off-session payment if available
        if (userWithSavedCard) {
          paymentIntentParams.customer = userWithSavedCard.stripe_customer_id;
          paymentIntentParams.payment_method = userWithSavedCard.stripe_default_payment_method_id;
          paymentIntentParams.confirmation_method = 'automatic';
          paymentIntentParams.confirm = true;
          paymentIntentParams.off_session = true;
          logStep('Creating off-session payment with saved card for additional services');
        }

        const newPaymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        logStep('New PaymentIntent created', { 
          payment_intent_id: newPaymentIntent.id,
          amount: additionalAmountCents 
        });

        // Create transaction record for the new PaymentIntent
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            booking_id,
            payment_intent_id: newPaymentIntent.id,
            amount: additionalAmount,
            currency: 'USD',
            status: 'pending',
            transaction_type: 'additional_authorization',
          });

        if (transactionError) {
          logStep('Warning: Failed to create transaction record', { error: transactionError.message });
        }

        // Update booking to mark it has pending additional payment
        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({ 
            has_modifications: true,
            pending_payment_amount: additionalAmount 
          })
          .eq('id', booking_id);

        if (bookingUpdateError) {
          logStep('Warning: Failed to update booking modifications flag', { error: bookingUpdateError.message });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            invoice_total: newTotal,
            additional_amount: additionalAmount,
            requires_additional_payment: true,
            payment_intent_client_secret: newPaymentIntent.client_secret,
            payment_intent_id: newPaymentIntent.id,
            message: 'Services added. Additional payment authorization required.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } catch (stripeError) {
      logStep('Stripe error', { error: stripeError.message });
      throw new Error(`Failed to process payment authorization: ${stripeError.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { error: message });
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to map city to state (simplified)
function getStateFromCity(city: string): string {
  const cityStateMap: { [key: string]: string } = {
    'austin': 'TX',
    'dallas': 'TX',
    'houston': 'TX',
    'san antonio': 'TX',
    'fort worth': 'TX',
    'new york': 'NY',
    'los angeles': 'CA',
    'chicago': 'IL',
    'miami': 'FL',
    'phoenix': 'AZ',
    'philadelphia': 'PA',
    'san diego': 'CA',
    'san francisco': 'CA',
    'seattle': 'WA',
    'denver': 'CO',
    'atlanta': 'GA',
    'boston': 'MA',
    'las vegas': 'NV',
    'detroit': 'MI',
    'portland': 'OR'
  };
  
  const normalizedCity = city?.toLowerCase().trim() || '';
  return cityStateMap[normalizedCity] || 'TX'; // Default to Texas
}

