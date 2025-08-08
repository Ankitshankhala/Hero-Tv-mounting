import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: smsFailed }, { data: emailFailed }, { data: smsTotal }, { data: emailTotal }] = await Promise.all([
      supabase.from('sms_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since),
      supabase.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since),
      supabase.from('sms_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('email_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);

    const metrics = {
      window_hours: 24,
      sms_failed: smsFailed?.length ?? 0,
      email_failed: emailFailed?.length ?? 0,
      sms_total: smsTotal?.length ?? 0,
      email_total: emailTotal?.length ?? 0,
    };

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
