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

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Missing required environment variables'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Supabase admin client created');

    // Verify the request is from an admin user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          details: 'No authorization header provided'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authorization header found');

    // Create regular client to verify user authentication
    const supabase = createClient(supabaseUrl, anonKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Invalid authorization:', authError);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed',
          details: authError?.message || 'Invalid authentication token'
        }),
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

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ 
          error: 'Permission verification failed',
          details: 'Unable to verify user permissions'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profile || profile.role !== 'admin') {
      console.error('Insufficient permissions. Profile:', profile);
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions',
          details: 'Admin access required'
        }),
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

    // Validate required application fields
    if (!application.email || !application.name) {
      console.error('Missing required application fields:', { email: application.email, name: application.name });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid application data',
          details: 'Missing required fields: email and name'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // Check if auth user already exists
    let existingAuthUser = null;
    try {
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(application.email);
      existingAuthUser = authUserData?.user;
    } catch (authCheckError) {
      // User doesn't exist in auth, which is fine
      console.log('No existing auth user found for:', application.email);
    }

    // Check if user profile already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', application.email)
      .maybeSingle()

    let workerId = null;
    let isExistingUser = false;

    if (existingUser) {
      console.log('User profile already exists:', existingUser.email, 'Role:', existingUser.role)
      
      if (existingUser.role === 'worker') {
        // User already exists as a worker - just mark as approved
        workerId = existingUser.id;
        isExistingUser = true;
        console.log('User is already a worker, no changes needed')
      } else {
        // Update existing user to worker role
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            name: application.name,
            phone: application.phone || null,
            city: application.city || null,
            zip_code: application.zip_code || null,
            role: 'worker',
            is_active: true,
          })
          .eq('id', existingUser.id)

        if (updateError) {
          console.error('Error updating user to worker:', updateError)
          return new Response(
            JSON.stringify({ 
              error: 'Failed to update user role',
              details: updateError.message
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        workerId = existingUser.id;
        isExistingUser = true;
        console.log('Existing user updated to worker role')
      }
    } else if (existingAuthUser) {
      // Auth user exists but no profile - create profile
      console.log('Creating profile for existing auth user:', existingAuthUser.id);
      
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: existingAuthUser.id,
          email: application.email,
          name: application.name,
          phone: application.phone || null,
          city: application.city || null,
          zip_code: application.zip_code || null,
          role: 'worker',
          is_active: true,
        })

      if (userError) {
        console.error('Error creating user profile for existing auth user:', userError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create user profile',
            details: userError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      workerId = existingAuthUser.id;
      isExistingUser = true;
      console.log('Profile created for existing auth user')
    } else {
      // Create completely new user
      console.log('Creating new user account...');
      
      try {
        // Create new auth user with admin privileges
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: application.email,
          password: temporaryPassword,
          email_confirm: true
        })

        if (authError) {
          console.error('Error creating auth user:', authError)
          
          // Handle specific auth errors
          if (authError.message?.includes('User already registered')) {
            return new Response(
              JSON.stringify({ 
                error: 'Email already registered',
                details: 'A user with this email already exists in the system'
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create user account',
              details: authError.message
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Auth user created:', authData.user.id);

        // Create user profile
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authData.user.id,
            email: application.email,
            name: application.name,
            phone: application.phone || null,
            city: application.city || null,
            zip_code: application.zip_code || null,
            role: 'worker',
            is_active: true,
          })

        if (userError) {
          console.error('Error creating user profile:', userError)
          
          // If profile creation fails, clean up the auth user
          try {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            console.log('Cleaned up auth user after profile creation failure');
          } catch (cleanupError) {
            console.error('Failed to clean up auth user:', cleanupError);
          }
          
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create user profile',
              details: userError.message
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        workerId = authData.user.id;
        console.log('New worker profile created successfully')
      } catch (createError) {
        console.error('Unexpected error during user creation:', createError)
        return new Response(
          JSON.stringify({ 
            error: 'User creation failed',
            details: createError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
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
    
    // Ensure we always return proper JSON
    let errorMessage = 'Internal server error';
    let errorDetails = 'An unexpected error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
      errorDetails = error;
    } else if (error && typeof error === 'object') {
      errorMessage = error.message || 'Unknown error';
      errorDetails = JSON.stringify(error, null, 2);
    }
    
    console.error('Error details:', { errorMessage, errorDetails });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
