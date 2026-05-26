# ZIP Code Validation & Booking Flow Hardening

## Goal
Eliminate "Invalid or missing ZIP code", "Invalid ZIP code format", Zippopotam 404s, and the wrong "Austin, SC" mapping by (a) normalizing ZIP codes through a single helper, (b) validating strictly before any RPC/insert, and (c) fixing the buggy external-API fallbacks that return wrong cities/states.

Important: I searched the codebase exhaustively — there is **no** `slice(0,4)` / `substring(0,4)` / `maxLength={4}` / `parseInt(zip)` truncation bug. Every input and service already caps at 5. The true root causes are listed below.

## Root Causes Identified

1. **`src/hooks/booking/useBookingOperations.ts`** — uses `formData.zipcode` raw. The only guard is `length < 5`, which allows `"78701 "`, `"78701-1234"`, `" 7870"`, mixed characters, etc. RPCs (`zip_has_active_coverage`, `find_available_workers_by_zip`) and the booking insert all receive whatever the form had.
2. **`src/services/zipcodeService.ts` — OpenDataSoft fallback** queries `?q=${zip}` (fuzzy full-text search, not a ZIP filter) and assigns `record.state` to BOTH `state` and `stateAbbr`. That's why `78701` can return **Austin, SC** when the fuzzy search matches an unrelated record.
3. No central `cleanZip()` helper — every call site re-implements cleaning, so future regressions are easy.

## Changes

### 1. New helper: `src/utils/zip.ts`
- `cleanZip(input: unknown): string` → `String(input ?? '').replace(/\D/g, '').slice(0, 5)`
- `isValidZip(input: unknown): boolean` → `/^\d{5}$/.test(cleanZip(input))`
- `assertValidZip(input: unknown, context?: string): string` → returns the cleaned 5-digit ZIP or throws `Invalid ZIP code format: "<raw>"`.

### 2. `src/hooks/booking/useBookingOperations.ts`
- Replace the `if (!formData.zipcode || formData.zipcode.length < 5)` guard with `const cleanZipcode = assertValidZip(formData.zipcode, 'booking');`.
- Use `cleanZipcode` for:
  - `zip_has_active_coverage` RPC
  - `find_available_workers_by_zip` RPC
  - `validateUSZipcode(cleanZipcode)` city derivation
  - `location_notes` string
  - The booking insert payload `zipcode: cleanZipcode`
  - Guest/auto-assign branch (`hasZipcode`) — re-validate before `auto_assign_workers_with_strict_zip_coverage`.
- Add the requested `console.debug('[ZIP DEBUG]', { original, cleaned, length, type })` log immediately before the insert.

### 3. `src/hooks/booking/useBookingFormState.ts` and form inputs
- In `handleZipcodeChange`, store `cleanZip(zipcode)` so internal state can never hold a partial/dirty value (typing UX preserved — input components already strip non-digits and cap at 5).

### 4. `src/services/zipcodeService.ts` — fix the "Austin, SC" bug
- **Remove the OpenDataSoft fuzzy fallback entirely** (it's the source of wrong city/state pairs because `q=` is full-text, not ZIP-keyed).
- Keep the order: local DB (`us_zip_codes`) → Zippopotam (ZIP-keyed) → final neutral fallback.
- For Zippopotam, also map `state abbreviation` correctly (already correct) and add a single retry on network error before falling back.
- Prefer the local in-memory ZIP index (`getLocalZipFast`) as the very first step to avoid Zippopotam 404s for valid ZIPs we already know about (e.g. 78701, 10001, 90210 are all in `zip-index-compact.json`).

### 5. `src/utils/zipcodeValidation.ts` (`validateUSZipcode`)
- Run input through `cleanZip()` at the top. If invalid → return `null` immediately (no external call, no 404 noise).
- Try local index first, then DB, then Zippopotam. Drop OpenDataSoft.

### 6. `src/utils/zctaServiceCoverage.ts` and `src/hooks/booking/useZctaWorkerAvailability.ts`
- Replace inline cleaning with `cleanZip()` / `isValidZip()` for consistency. Short-circuit with a clear error when invalid instead of calling RPCs with garbage.

### 7. (Optional polish) `src/services/zipcodeService.ts::mapToRegion`
- Leave behavior unchanged (out of scope). Just note it always returns `'downtown'` when no substring matches — not a bug for this fix but worth a follow-up.

## Files Touched

- **New:** `src/utils/zip.ts`
- **Edited:** `src/hooks/booking/useBookingOperations.ts`
- **Edited:** `src/hooks/booking/useBookingFormState.ts`
- **Edited:** `src/services/zipcodeService.ts` (remove OpenDataSoft, prefer local index)
- **Edited:** `src/utils/zipcodeValidation.ts` (use `cleanZip`, drop OpenDataSoft path)
- **Edited:** `src/utils/zctaServiceCoverage.ts`
- **Edited:** `src/hooks/booking/useZctaWorkerAvailability.ts`

## Out of Scope (no change)

- DB schema / RLS — `zip_code` columns are already `text`.
- Worker assignment SQL functions (`find_available_workers_by_zip`, `auto_assign_workers_with_strict_zip_coverage`) — they already take text ZIPs.
- Stripe / payment flow — it doesn't touch ZIP processing logic.
- Admin ZIP manager UI — already correct.
- Input UI components (`ZipcodeInput`, `EnhancedZipcodeInput`, `ZctaLocationInput`, `ZipcodeLocationInput`) — already strip non-digits and cap at 5.

## Verification

After the edit:
- Type `78701`, `10001`, `90210` in the checkout form → coverage RPC and worker lookup both fire with exactly that 5-digit string; `[ZIP DEBUG]` log shows `length: 5, type: 'string'`.
- Confirm city/state resolves to `Austin, TX` (from the local index), not `Austin, SC`.
- Authenticated booking, guest booking, and the payment-pending path all reuse `cleanZipcode` (the same variable) into the Supabase insert, eliminating the 400.
- Submitting `"78701-1234"` or `" 78701 "` no longer throws — gets normalized to `78701`.
- Submitting `"abcd"` or `""` throws the new explicit `Invalid ZIP code format: "..."` error before any Supabase call.
