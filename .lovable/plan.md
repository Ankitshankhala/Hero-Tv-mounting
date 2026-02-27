

# Fix: Make Admin Login Resilient to Network Hiccups

## Problem

The `signIn` function in `useAuth.tsx` performs two unnecessary operations before the actual login:
1. `cleanupAuthState()` — clears all Supabase tokens from localStorage/sessionStorage
2. `supabase.auth.signOut({ scope: 'global' })` — makes a network request to invalidate all sessions

Both of these run BEFORE the actual `signInWithPassword` call. On flaky connections (like the Lovable preview environment), the signOut network call can fail or time out, and clearing localStorage corrupts the Supabase client's internal state.

Additionally, the user is logging in with the wrong email (`captain@herotvmounting.com` instead of `admin@herotvmounting.com`).

## Fix

**File:** `src/hooks/useAuth.tsx` — `signIn` function (lines 127-152)

Remove the `cleanupAuthState()` call and the pre-login `signOut({ scope: 'global' })` call. These should only happen on explicit sign-out, not before every sign-in. The Supabase client handles session replacement automatically when `signInWithPassword` succeeds.

```text
Before:
  cleanupAuthState()           // clears localStorage — breaks client state
  signOut({ scope: 'global' }) // network call — can fail on flaky connections  
  signInWithPassword(...)      // actual login

After:
  signInWithPassword(...)      // just sign in — Supabase replaces the session automatically
```

This removes one network round-trip and prevents localStorage corruption, making login work even on intermittent connections.

## Summary

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Remove `cleanupAuthState()` and pre-login `signOut()` from the `signIn` function |

