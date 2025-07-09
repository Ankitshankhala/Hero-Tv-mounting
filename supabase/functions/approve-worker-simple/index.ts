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
    console.log('=== Simple Worker Approval Started ===');
    
    // Parse request
    const { applicationId } = await req.json();
    if (!applicationId) {
      throw new Error('Application ID is required');
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

    // Get application
    const { data: application, error: appError } = await supabaseAdmin
      .from('worker_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      throw new Error('Application not found');
    }

    console.log('Application found:', application.email);

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', application.email)
      .maybeSingle();

    let workerId: string;
    let isExistingUser = false;
    let temporaryPassword: string | null = null;

    if (existingUser) {
      // Update existing user
      workerId = existingUser.id;
      isExistingUser = true;
      
      await supabaseAdmin
        .from('users')
        .update({
          name: application.name,
          phone: application.phone,
          city: application.city,
          zip_code: application.zip_code,
          role: 'worker',
          is_active: true,
        })
        .eq('id', existingUser.id);

    } else {
      // Create new user
      temporaryPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 58])
        .join('');

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: application.email,
        password: temporaryPassword,
        email_confirm: true
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }

      workerId = authData.user.id;

      await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: application.email,
          name: application.name,
          phone: application.phone,
          city: application.city,
          zip_code: application.zip_code,
          role: 'worker',
          is_active: true,
        });
    }

    // Update application status
    await supabaseAdmin
      .from('worker_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId);

    console.log('Application approved successfully');

    const responseData = {
      success: true,
      message: 'Worker application approved successfully',
      workerId,
      isExistingUser,
      ...(temporaryPassword ? {
        email: application.email,
        temporaryPassword: temporaryPassword
      } : {})
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Simple approval error:', error);
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