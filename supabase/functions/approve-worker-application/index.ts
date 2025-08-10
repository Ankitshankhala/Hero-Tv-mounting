import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== Function execution started ===');
  
  // Always handle CORS first
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Worker Application Approval Started ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Step 1: Test environment variables
    console.log('Step 1: Checking environment variables...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('Environment variables check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      hasAnonKey: !!anonKey,
      urlLength: supabaseUrl?.length || 0,
      serviceKeyLength: serviceRoleKey?.length || 0,
      anonKeyLength: anonKey?.length || 0
    });
    
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
    
    console.log('Step 1 completed: Environment variables OK');

    // Step 2: Parse request body
    console.log('Step 2: Parsing request body...');
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', requestBody);
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON in request body' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { applicationId } = requestBody;
    if (!applicationId) {
      console.error('Application ID is missing from request');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Application ID is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Step 2 completed: Processing application ID:', applicationId);

    // Step 3: Create Supabase clients
    console.log('Step 3: Creating Supabase clients...');
    let supabaseAdmin, supabase;
    try {
      supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      console.log('Admin client created successfully');

      supabase = createClient(supabaseUrl, anonKey);
      console.log('Anon client created successfully');
    } catch (error) {
      console.error('Failed to create Supabase clients:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to initialize database connection' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Step 3 completed: Supabase clients ready');

    // Step 4: Get and verify authorization
    console.log('Step 4: Checking authorization...');
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header found');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authorization required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is admin
    console.log('Verifying user authentication...');
    let user;
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (authError) {
        console.error('Auth verification failed:', authError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid authorization' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!authUser) {
        console.error('No user found from auth token');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid authorization' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      user = authUser;
      console.log('User authenticated successfully:', user.email);
    } catch (error) {
      console.error('Exception during auth verification:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication failed' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Step 4 completed: User authenticated');

    // Step 5: Check if user is admin
    console.log('Step 5: Verifying admin privileges...');
    let adminProfile;
    try {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile query error:', profileError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to verify admin privileges' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!profileData) {
        console.error('No profile found for user:', user.id);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'User profile not found' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (profileData.role !== 'admin') {
        console.error('User is not admin. Role:', profileData.role);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Admin privileges required' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      adminProfile = profileData;
      console.log('Admin verification passed for user:', user.email);
    } catch (error) {
      console.error('Exception during admin check:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to verify admin privileges' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Step 5 completed: Admin privileges verified');

    // Step 6: Get the worker application
    console.log('Step 6: Retrieving worker application...');
    let application;
    try {
      const { data: appData, error: appError } = await supabaseAdmin
        .from('worker_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (appError) {
        console.error('Application query error:', appError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to retrieve worker application' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (!appData) {
        console.error('Application not found for ID:', applicationId);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Worker application not found' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      application = appData;
      console.log('Application found for:', application.email);
    } catch (error) {
      console.error('Exception during application retrieval:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to retrieve worker application' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Step 6 completed: Application retrieved');

    // Step 7: Check if user already exists
    console.log('Step 7: Checking for existing user...');
    let existingUser = null;
    let workerId = null;
    let isExistingUser = false;
    let temporaryPassword = null;
    
    try {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, email, role')
        .eq('email', application.email)
        .maybeSingle();

      if (userError) {
        console.error('Error checking for existing user:', userError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to check for existing user' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      existingUser = userData;
      console.log('Existing user check result:', existingUser ? 'Found' : 'Not found');
    } catch (error) {
      console.error('Exception during existing user check:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to check for existing user' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Step 7 completed: User existence checked');

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

    // If a new user was created with temporary password, send welcome email
    if (temporaryPassword) {
      console.log('Sending welcome email to new worker...');
      try {
        const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke(
          'send-worker-welcome-email',
          {
            body: {
              email: application.email,
              name: application.name,
              temporaryPassword: temporaryPassword
            }
          }
        );

        if (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail the whole approval process if email fails
        } else {
          console.log('Welcome email sent successfully:', emailData);
        }
      } catch (emailException) {
        console.error('Exception while sending welcome email:', emailException);
        // Don't fail the whole approval process if email fails
      }
    }

    // Return success response
    const responseData = {
      success: true,
      message: 'Worker application approved successfully',
      workerId,
      isExistingUser,
      emailSent: !!temporaryPassword,
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