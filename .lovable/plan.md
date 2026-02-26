

# Fix: Admin Not Loading & Auth Recovery Not Working

## Root Cause

The `supabase.auth.refreshSession` patch added in the previous fix does NOT intercept Supabase's internal automatic token refresh. Supabase internally calls a private `_refreshAccessToken` method, which bypasses the patched public method. This means:

- The stale refresh token (`j4xsmgyp2vd6`) keeps retrying forever
- The 3-failure auto-signout never triggers
- `getSession()` in `useAuth.tsx` hangs waiting for the refresh to complete
- `loading` stays `true`, so the Admin page shows an infinite spinner
- Network congestion from the retry loop also slows down image loading

## Solution

### 1. Add auth initialization timeout to `useAuth.tsx`

Add a safety timeout (5 seconds) to the `initializeAuth` function. If `getSession()` doesn't resolve within that time, force `loading = false`, clear the stale auth state, and let the page render (showing the login form for admin, or the public homepage for services).

```text
File: src/hooks/useAuth.tsx

In initializeAuth():
- Wrap getSession() with a Promise.race against a 5-second timeout
- On timeout: call cleanupAuthState(), set loading=false, clear user/session
- This breaks the infinite loading spinner
```

### 2. Replace the broken refreshSession patch in `client.ts`

Remove the current `refreshSession` monkey-patch (it doesn't work for internal refreshes). Replace it with a simpler approach: a periodic check that detects if the auth state has been stuck with a stale token. Use `onAuthStateChange` combined with a timer:

```text
File: src/integrations/supabase/client.ts

- Remove the refreshSession monkey-patch (lines 31-57)
- Add a "stuck auth detector": after the client is created, set up a listener
  that tracks the last successful auth event timestamp
- If no successful TOKEN_REFRESHED event occurs within 15 seconds of the first
  failure, automatically call signOut({ scope: 'local' }) to clear stale tokens
```

### 3. Service images -- no code changes needed

The `ServicesSection.tsx` is already correct:
- Uses `service.image_url` from database/fallback data as the primary source
- Falls back to `GENERIC_PLACEHOLDER` on error
- Once the auth loop is broken, Supabase storage URLs will load normally again

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Add 5-second timeout to `initializeAuth` to prevent infinite loading |
| `src/integrations/supabase/client.ts` | Replace broken `refreshSession` patch with a timer-based stuck-auth detector |

## Expected Result

- Admin page loads within 5 seconds even with a stale token (shows login form)
- Stale auth sessions are automatically cleared, breaking the refresh loop
- Service images load normally once network congestion from the retry loop stops
- No database or edge function changes needed

