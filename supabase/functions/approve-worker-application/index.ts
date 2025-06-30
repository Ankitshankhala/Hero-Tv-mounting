import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting approve-worker-application function...');

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('Supabase admin client created');

    // Verify the request is from an admin user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authorization header found');

    // Create regular client to verify user authentication
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Invalid authorization:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.email);

    // Check if user is admin using the admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      console.error('Insufficient permissions. Profile:', profile, 'Error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin user verified');

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { applicationId } = requestBody;

    if (!applicationId) {
      console.error('Application ID is required');
      return new Response(
        JSON.stringify({ error: 'Application ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing application:', applicationId);

    // Get the application details
    const { data: application, error: appError } = await supabaseAdmin
      .from('worker_applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      console.error('Application not found:', appError);
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing application for:', application.email);

    // Generate temporary password
    const generateTemporaryPassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const temporaryPassword = generateTemporaryPassword();

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', application.email)
      .maybeSingle()

    let workerId = null;
    let isExistingUser = false;

    if (existingUser) {
      console.log('User already exists:', existingUser.email)
      
      if (existingUser.role === 'worker') {
        // User already exists as a worker
        workerId = existingUser.id;
        isExistingUser = true;
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
          .eq('id', existingUser.id)

        if (updateError) {
          console.error('Error updating user to worker:', updateError)
          throw updateError
        }

        workerId = existingUser.id;
        isExistingUser = true;
        console.log('Existing user updated to worker role')
      }
    } else {
      console.log('Creating new user account...');
      
      // Create new auth user with admin privileges
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: application.email,
        password: temporaryPassword,
        email_confirm: true
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        throw authError
      }

      console.log('Auth user created:', authData.user.id);

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
        })

      if (userError) {
        console.error('Error creating user profile:', userError)
        throw userError
      }

      workerId = authData.user.id;
      console.log('New worker profile created successfully')
    }

    // Update application status
    const { error: statusError } = await supabaseAdmin
      .from('worker_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId)

    if (statusError) {
      console.error('Error updating application status:', statusError)
      throw statusError
    }

    console.log('Application status updated to approved');

    // Return success response
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

    console.log('Returning success response');

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in approve-worker-application function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
