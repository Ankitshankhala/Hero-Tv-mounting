

# Create Admin User: admin@herotvmounting.com

## Approach

Create a one-time-use edge function `create-admin-user` that:
1. Creates the auth user in Supabase Auth with email `admin@herotvmounting.com` and password `Impervious96!!`
2. Inserts the corresponding profile row in the `users` table with `role = 'admin'`
3. Returns success/failure status

After running it once, the function can be deleted.

## Files to Create/Edit

### 1. `supabase/functions/create-admin-user/index.ts` (NEW)

- Uses the service role client (from `_shared/supabaseClient.ts`) to call `supabase.auth.admin.createUser()`
- Sets `email_confirm: true` so the user can log in immediately without email verification
- Inserts a row into `users` table with `role: 'admin'`, `name: 'Admin'`, `email: admin@herotvmounting.com`
- Protected by a simple shared secret check (the service role key itself) to prevent unauthorized calls

### 2. `supabase/config.toml`

- Add `[functions.create-admin-user]` with `verify_jwt = false` (since we call it before logging in)

## Execution Plan

1. Create the edge function
2. Add config entry
3. Deploy the function
4. Call it via `curl_edge_functions` to create the user
5. Verify the user exists in the database
6. Delete the edge function (cleanup)

## Security Note

The function uses the `SUPABASE_SERVICE_ROLE_KEY` as a bearer token check, so only someone with the service role key can invoke it. After successful creation, the function will be removed from the codebase.

