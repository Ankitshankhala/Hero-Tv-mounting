

# Reset Admin Login to captain@herotvmounting.com

## What We'll Do

Create a one-time edge function that uses the Supabase Admin API to:
1. Update the existing admin auth user's email from `admin@herotvmounting.com` to `captain@herotvmounting.com`
2. Set a new password you can use immediately
3. Update the `users` table email to match
4. Delete the edge function after use (it's a one-time utility)

## Steps

### 1. Create edge function `reset-admin-login`
- Uses `supabase.auth.admin.updateUserById()` to change the email and password for user `f47ac10b-58cc-4372-a567-0e02b2c3d479`
- Sets email to `captain@herotvmounting.com` with `email_confirm: true` (no verification needed)
- Sets a temporary password: `HeroAdmin2026!`
- Updates the `users` table email to match

### 2. Update the `users` table RLS policy
- The existing "Direct admin access" RLS policy hardcodes `admin@herotvmounting.com` -- update it to use `captain@herotvmounting.com`

### 3. Call the edge function once to apply the change

### 4. Delete the edge function (security -- it should not persist)

## After Implementation

You'll be able to log in at `/admin` with:
- **Email:** captain@herotvmounting.com
- **Password:** HeroAdmin2026!

You should change the password after first login.

## Technical Details

| Step | Action |
|---|---|
| Edge function | `supabase/functions/reset-admin-login/index.ts` -- one-time admin credential reset |
| SQL migration | Update "Direct admin access" RLS policy on `users` table to reference new email |
| Users table | Update email column from `admin@herotvmounting.com` to `captain@herotvmounting.com` |
| Cleanup | Delete the edge function after successful execution |

