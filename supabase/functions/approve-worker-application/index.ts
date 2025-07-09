import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const generateTemporaryPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== STARTING WORKER APPLICATION APPROVAL ===');
    
    // Step 1: Environment Check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('Environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      hasAnonKey: !!anonKey
    });

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing required environment variables');
    }

    // Step 2: Parse Request
    const { applicationId } = await req.json();
    if (!applicationId) {
      throw new Error('Application ID is required');
    }
    console.log('Processing application ID:', applicationId);

    // Step 3: Create Supabase Admin Client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    console.log('✓ Supabase admin client created');

    // Step 4: Verify Admin Authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabase = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Invalid authorization');
    }
    console.log('✓ User authenticated:', user.email);

    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !adminProfile || adminProfile.role !== 'admin') {
      console.error('Profile check failed:', { profileError, adminProfile });
      throw new Error('Insufficient permissions - admin role required');
    }
    console.log('✓ Admin permissions verified');

    // Step 5: Get Application Details
    const { data: application, error: appError } = await supabaseAdmin
      .from('worker_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      console.error('Application lookup failed:', appError);
      throw new Error('Worker application not found');
    }
    console.log('✓ Application found:', application.email);

    // Step 6: Check for Existing User
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', application.email)
      .maybeSingle();

    let workerId = null;
    let isExistingUser = false;
    const temporaryPassword = generateTemporaryPassword();

    if (existingUser) {
      console.log('✓ Existing user found:', existingUser.email);
      
      if (existingUser.role === 'worker') {
        workerId = existingUser.id;
        isExistingUser = true;
        console.log('✓ User already has worker role');
      } else {
        // Update existing user to worker role
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
          console.error('User update failed:', updateError);
          throw new Error('Failed to update user to worker role');
        }

        workerId = existingUser.id;
        isExistingUser = true;
        console.log('✓ Existing user updated to worker role');
      }
    } else {
      console.log('Creating new user account...');
      
      // Step 7a: Create Auth User
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: application.email,
        password: temporaryPassword,
        email_confirm: true
      });

      if (authError) {
        console.error('Auth user creation failed:', authError);
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }
      console.log('✓ Auth user created:', authData.user.id);

      // Step 7b: Create User Profile
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
        console.error('User profile creation failed:', userError);
        throw new Error(`Failed to create user profile: ${userError.message}`);
      }

      workerId = authData.user.id;
      console.log('✓ New worker profile created successfully');
    }

    // Step 8: Update Application Status
    const { error: statusError } = await supabaseAdmin
      .from('worker_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId);

    if (statusError) {
      console.error('Status update failed:', statusError);
      throw new Error(`Failed to update application status: ${statusError.message}`);
    }
    console.log('✓ Application status updated to approved');

    // Step 9: Return Success Response
    const responseData = {
      success: true,
      message: 'Worker application approved successfully',
      workerId,
      isExistingUser,
      ...(isExistingUser ? {} : {
        email: application.email,
        temporaryPassword: temporaryPassword
      })
    };

    console.log('=== APPROVAL COMPLETED SUCCESSFULLY ===');
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== APPROVAL FAILED ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
