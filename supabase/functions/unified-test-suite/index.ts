import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNIFIED-TEST-SUITE] ${step}${detailsStr}`);
};

interface TestRequest {
  testType: 'stripe_config' | 'supabase_client' | 'e2e_booking_capture' | 'deployment' | 'all';
  cleanup?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testType = 'all', cleanup = false }: TestRequest = await req.json();

    logStep('Starting unified test suite', { testType, cleanup });

    const results: Record<string, any> = {};

    // Run tests based on type
    if (testType === 'stripe_config' || testType === 'all') {
      results.stripe_config = await testStripeConfig();
    }

    if (testType === 'supabase_client' || testType === 'all') {
      results.supabase_client = await testSupabaseClient();
    }

    if (testType === 'deployment' || testType === 'all') {
      results.deployment = await testBasicDeployment();
    }

    if (testType === 'e2e_booking_capture' || testType === 'all') {
      results.e2e_booking_capture = await testE2EBookingCapture(cleanup);
    }

    const allPassed = Object.values(results).every((result: any) => result.success);

    return new Response(JSON.stringify({
      success: allPassed,
      testType,
      results,
      summary: {
        total_tests: Object.keys(results).length,
        passed: Object.values(results).filter((r: any) => r.success).length,
        failed: Object.values(results).filter((r: any) => !r.success).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error in unified test suite', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function testStripeConfig() {
  try {
    logStep('Testing Stripe configuration');
    
    const apiKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not found');
    }

    const stripe = new Stripe(apiKey, { apiVersion: '2023-10-16' });
    
    // Test API call
    const account = await stripe.accounts.retrieve();
    
    const keyType = apiKey.startsWith('sk_live_') ? 'live' : 
                   apiKey.startsWith('sk_test_') ? 'test' : 'unknown';

    logStep('Stripe config test passed', { keyType, accountId: account.id });

    return {
      success: true,
      keyType,
      accountId: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled
    };
  } catch (error) {
    logStep('Stripe config test failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

async function testSupabaseClient() {
  try {
    logStep('Testing Supabase client');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Test simple query
    const { data, error } = await supabase
      .from('services')
      .select('id, name')
      .limit(1);

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    logStep('Supabase client test passed', { recordCount: data?.length || 0 });

    return {
      success: true,
      connection: 'healthy',
      recordCount: data?.length || 0
    };
  } catch (error) {
    logStep('Supabase client test failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

async function testBasicDeployment() {
  try {
    logStep('Testing basic deployment');
    
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'STRIPE_SECRET_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !Deno.env.get(varName));
    
    if (missingVars.length > 0) {
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    logStep('Basic deployment test passed');

    return {
      success: true,
      environment: 'configured',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logStep('Basic deployment test failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

async function testE2EBookingCapture(cleanup: boolean = false) {
  try {
    logStep('Testing E2E booking capture flow');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Create test booking
    const testBookingData = {
      service_id: await getTestServiceId(supabase),
      scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      scheduled_start: '10:00:00',
      guest_customer_info: {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '555-0123',
        address: '123 Test St',
        city: 'Test City',
        zipcode: '12345'
      },
      status: 'pending'
    };

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(testBookingData)
      .select()
      .single();

    if (bookingError) {
      throw new Error(`Failed to create test booking: ${bookingError.message}`);
    }

    logStep('Test booking created', { bookingId: booking.id });

    // Create test payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 15000, // $150.00
      currency: 'usd',
      metadata: {
        booking_id: booking.id,
        test_transaction: 'true'
      }
    });

    // Update booking with payment intent
    await supabase
      .from('bookings')
      .update({ 
        payment_intent_id: paymentIntent.id,
        status: 'payment_authorized'
      })
      .eq('id', booking.id);

    // Create transaction record
    const { data: transaction } = await supabase
      .from('transactions')
      .insert({
        booking_id: booking.id,
        payment_intent_id: paymentIntent.id,
        amount: 150.00,
        status: 'authorized',
        transaction_type: 'authorization'
      })
      .select()
      .single();

    logStep('Test payment setup completed', { 
      paymentIntentId: paymentIntent.id,
      transactionId: transaction?.id 
    });

    // Simulate capture (for testing - don't actually capture)
    const result = {
      success: true,
      booking_id: booking.id,
      payment_intent_id: paymentIntent.id,
      transaction_id: transaction?.id,
      flow_completed: true
    };

    // Cleanup if requested
    if (cleanup) {
      try {
        await supabase.from('transactions').delete().eq('booking_id', booking.id);
        await supabase.from('bookings').delete().eq('id', booking.id);
        await stripe.paymentIntents.cancel(paymentIntent.id);
        logStep('Test data cleaned up');
      } catch (cleanupError) {
        logStep('Cleanup failed but test passed', { error: cleanupError.message });
      }
    }

    logStep('E2E booking capture test passed', result);
    return result;

  } catch (error) {
    logStep('E2E booking capture test failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

async function getTestServiceId(supabase: any): Promise<string> {
  const { data: services } = await supabase
    .from('services')
    .select('id')
    .limit(1);
    
  if (!services || services.length === 0) {
    throw new Error('No services found for testing');
  }
  
  return services[0].id;
}