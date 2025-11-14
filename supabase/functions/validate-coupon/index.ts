import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      code, 
      customerEmail, 
      userId, 
      cartTotal, 
      zipcode, 
      city, 
      serviceIds 
    } = await req.json();

    console.log(`[VALIDATE-COUPON] Validating coupon: ${code} for email: ${customerEmail}, cart: $${cartTotal}`);

    // Call the database function to validate coupon
    const { data, error } = await supabase.rpc('is_coupon_valid', {
      p_code: code,
      p_customer_email: customerEmail || '',
      p_user_id: userId || null,
      p_cart_total: cartTotal,
      p_city: city || '',
      p_service_ids: serviceIds || []
    });

    if (error) {
      console.error('[VALIDATE-COUPON] Database error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          errorMessage: 'Unable to validate coupon' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const result = data[0];

    console.log(`[VALIDATE-COUPON] Validation result:`, result);

    if (result.valid) {
      // Fetch coupon details for response
      const { data: couponData } = await supabase
        .from('coupons')
        .select('code, discount_type, discount_value, max_discount_amount')
        .eq('id', result.coupon_id)
        .single();

      return new Response(
        JSON.stringify({
          valid: true,
          couponId: result.coupon_id,
          discountAmount: parseFloat(result.discount_amount),
          couponDetails: couponData || {}
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          valid: false,
          errorMessage: result.error_message
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[VALIDATE-COUPON] Error: ${errorMessage}`);
    
    return new Response(
      JSON.stringify({ 
        valid: false,
        errorMessage: 'Failed to validate coupon. Please try again.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});