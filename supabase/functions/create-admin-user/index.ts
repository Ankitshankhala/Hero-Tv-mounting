import { getSupabaseClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const email = 'admin@herotvmounting.com';
    const logs: string[] = [];

    // Step 1: Try listing all users to find if one exists
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 50, page: 1 });
    logs.push(`listUsers: ${listData?.users?.length ?? 0} users found, error: ${listError?.message ?? 'none'}`);
    
    const existing = listData?.users?.find(u => u.email === email);
    logs.push(`existing user: ${existing ? existing.id : 'not found'}`);

    let userId: string;

    if (existing) {
      userId = existing.id;
      // Update password
      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { password: 'Impervious96!!' });
      logs.push(`updateUser: ${updateErr?.message ?? 'success'}`);
    } else {
      // Delete any identities with this email first (cleanup)
      // Then create fresh
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: 'Impervious96!!',
        email_confirm: true,
      });
      logs.push(`createUser: ${authError?.message ?? 'success'}, id: ${authData?.user?.id ?? 'none'}`);
      
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message, logs }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = authData.user.id;
    }

    // Step 2: Upsert profile row
    const { error: profileError } = await supabase.from('users').upsert({
      id: userId,
      email,
      name: 'Admin',
      role: 'admin',
    }, { onConflict: 'id' });
    logs.push(`upsert profile: ${profileError?.message ?? 'success'}`);

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message, userId, logs }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, userId, logs }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
