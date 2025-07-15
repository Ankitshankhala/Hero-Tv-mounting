import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Worker Password Management Started ===');
    
    const { workerId, action, newPassword } = await req.json();
    
    if (!workerId || !action) {
      throw new Error('Worker ID and action are required');
    }

    // Environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing environment variables');
    }

    // Create Supabase client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get worker details
    const { data: worker, error: workerError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role')
      .eq('id', workerId)
      .eq('role', 'worker')
      .single();

    if (workerError || !worker) {
      throw new Error('Worker not found');
    }

    console.log('Worker found:', worker.email);

    let response: any = { success: true, email: worker.email };

    if (action === 'generate') {
      // Generate new temporary password
      const temporaryPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 58])
        .join('');

      // Update user password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(workerId, {
        password: temporaryPassword
      });

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      response.temporaryPassword = temporaryPassword;
      response.message = 'Temporary password generated successfully';
      
      console.log('Temporary password generated for:', worker.email);
    } else if (action === 'set' && newPassword) {
      // Set custom password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(workerId, {
        password: newPassword
      });

      if (updateError) {
        throw new Error(`Failed to set password: ${updateError.message}`);
      }

      response.message = 'Password set successfully';
      
      console.log('Password set for:', worker.email);
    } else {
      throw new Error('Invalid action or missing password');
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Password management error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});