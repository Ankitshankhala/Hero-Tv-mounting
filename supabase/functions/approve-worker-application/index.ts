import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Always handle CORS first
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Worker Application Approval Started ===');
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Server configuration error - missing environment variables' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { applicationId } = await req.json();
    if (!applicationId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Application ID is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Processing application ID:', applicationId);

    // Create Supabase clients
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const supabase = createClient(supabaseUrl, anonKey);

    // Get authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authorization required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid authorization' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !adminProfile || adminProfile.role !== 'admin') {
      console.error('Admin check failed:', { profileError, adminProfile });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Admin privileges required' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Admin verification passed');

    // Get the application
    const { data: application, error: appError } = await supabaseAdmin
      .from('worker_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      console.error('Application not found:', appError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Worker application not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Application found:', application.email);

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', application.email)
      .maybeSingle();

    let workerId = null;
    let isExistingUser = false;
    let temporaryPassword = null;

    if (existingUser) {
      console.log('Existing user found, updating to worker role');
      workerId = existingUser.id;
      isExistingUser = true;

      // Update existing user to worker role if not already
      if (existingUser.role !== 'worker') {
        const { error: updateError } = await supabaseAdmin
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

        if (updateError) {
          console.error('Failed to update existing user:', updateError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to update user to worker role' 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    } else {
      console.log('Creating new user account');
      
      // Generate temporary password
      temporaryPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 58])
        .join('');

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: application.email,
        password: temporaryPassword,
        email_confirm: true
      });

      if (authError) {
        console.error('Failed to create auth user:', authError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Failed to create user account: ${authError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      workerId = authData.user.id;
      console.log('Auth user created:', workerId);

      // Create user profile
      const { error: userError } = await supabaseAdmin
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

      if (userError) {
        console.error('Failed to create user profile:', userError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Failed to create user profile: ${userError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('User profile created successfully');
    }

    // Update application status
    const { error: statusError } = await supabaseAdmin
      .from('worker_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId);

    if (statusError) {
      console.error('Failed to update application status:', statusError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update application status' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Application approved successfully');

    // Return success response
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
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: `Server error: ${error.message}`,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});