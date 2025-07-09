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
    console.log('🚀 Function started');
    
    // Basic environment check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('❌ Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Environment variables found');

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify admin user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('❌ Auth failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ User authenticated:', user.email);

    // Check admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      console.error('❌ Not admin or profile error:', profileError?.message);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Admin verified');

    // Parse request
    const { applicationId } = await req.json();
    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: 'Application ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📋 Processing application:', applicationId);

    // Get application
    const { data: application, error: appError } = await supabaseAdmin
      .from('worker_applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      console.error('❌ Application not found:', appError?.message);
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Application found:', application.email);

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', application.email)
      .maybeSingle()

    let workerId = null;
    let isExistingUser = false;

    if (existingUser) {
      console.log('📧 User exists:', existingUser.role);
      
      if (existingUser.role === 'worker') {
        // Already a worker, just approve
        workerId = existingUser.id;
        isExistingUser = true;
      } else {
        // Update to worker role
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
          console.error('❌ Update failed:', updateError.message);
          return new Response(
            JSON.stringify({ error: 'Failed to update user' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        workerId = existingUser.id;
        isExistingUser = true;
      }
    } else {
      console.log('🆕 Creating new user');
      
      // Generate password
      const temporaryPassword = Array.from({ length: 12 }, () => 
        'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
        .charAt(Math.floor(Math.random() * 58))
      ).join('');

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: application.email,
        password: temporaryPassword,
        email_confirm: true
      })

      if (authError) {
        console.error('❌ Auth creation failed:', authError.message);
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ Auth user created');

      // Create profile
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
        console.error('❌ Profile creation failed:', userError.message);
        
        // Cleanup auth user
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (cleanupError) {
          console.error('⚠️ Cleanup failed:', cleanupError);
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to create user profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      workerId = authData.user.id;
      console.log('✅ Profile created');
    }

    // Update application status
    const { error: statusError } = await supabaseAdmin
      .from('worker_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId)

    if (statusError) {
      console.error('❌ Status update failed:', statusError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to update application status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Application approved');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Worker application approved successfully',
        workerId,
        isExistingUser
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
