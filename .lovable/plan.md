
# Diagnostic Report — worker email/phone exposure via ZCTA services

## TL;DR

**YES — worker `email` and `phone` are currently reachable by an anonymous visitor.** Triggered by simply entering a ZIP code in the booking flow's location step (before any login). The values arrive in the network response but are dropped by the frontend before rendering, so nothing visible in the UI reveals them — however, anyone with DevTools/Network inspector sees them in the raw response.

`zctaServiceOptimized.ts` (line 63) is **dead code** — no importer anywhere in `src/`.

---

## 1. Call chain for `zctaOnlyService.ts:312` (SELECT id, name, email, phone)

The query lives inside `findAvailableWorkersWithAreaInfo()` (lines 287–350).

### Callers of `findAvailableWorkersWithAreaInfo`

- `src/hooks/useZctaBookingIntegration.ts:87` — inside `findAvailableWorkers` callback
- `src/hooks/useZctaBookingIntegration.ts:138` — inside `checkCoverage` callback (fires with `today` / `09:00`)
- `src/services/zctaOnlyService.ts:396` — internal use inside `autoAssignWorkerToBooking`

### Path that runs under anon guest booking

```
EnhancedInlineBookingFlow.tsx (routed at / and /locations/:slug — LIVE)
  └── ContactLocationStep (src/components/booking/ContactLocationStep.tsx:7)
       └── ZctaLocationInput (src/components/booking/ZctaLocationInput.tsx:15)
            └── useZipcodeValidationCompat  (useZctaBookingIntegration.ts:195)
                 └── validateZipcode → Promise.all([validateZctaCode, checkCoverage])
                                                            │
                                                            └── checkCoverage
                                                                 └── findAvailableWorkersWithAreaInfo(zip, today, '09:00')
                                                                      └── supabase.from('users').select('id, name, email, phone')
                                                                             .eq('role', 'worker').eq('is_active', true)
```

**Trigger:** the anon visitor typing a ZIP into the location step of the booking flow. `useZipcodeValidationCompat.validateZipcode` runs on ZIP submit/blur inside `ZctaLocationInput`, which calls `checkCoverage`, which unconditionally invokes `findAvailableWorkersWithAreaInfo`.

### Other paths (not anon)

- `useZctaBookingIntegration.findAvailableWorkers` — only invoked from admin `ZctaManagementDashboard.tsx` and from the compat hook indirectly (already covered above).
- `autoAssignWorkerToBooking` — invoked from admin dashboard and via booking-server flow.

---

## 2. Call chain for `zctaServiceOptimized.ts:63` (SELECT id, name, city)

**Zero importers.** `rg "zctaServiceOptimized"` across `src/` returns no matches outside the file itself. It is dead code and does not execute in any user-facing path (anon, authenticated, or admin). No RLS-tightening decision needs to preserve it.

---

## 3. Does the frontend display or use the email/phone?

Followed the data flow after the DB round-trip:

- `useZctaBookingIntegration.ts:138–145` — `checkCoverage` maps each worker result into only `{ id, name, city: area_name, coverage_source }`. `email` and `phone` are **discarded** before reaching component state.
- `useZipcodeValidationCompat` returns only `coverageInfo` / `workerCount` / `locationData` — no worker contact fields.
- `ZctaLocationInput` and `ContactLocationStep` render workerCount / city, never email or phone.

So `email` and `phone` are **fetched but unused** by the UI on the anon path — a classic over-fetch. However, PostgREST returns them in the JSON response body (visible in DevTools → Network → `users?select=id,name,email,phone&role=eq.worker...`). This is a real (though passive) PII disclosure to any unauthenticated user who inspects network traffic.

---

## 3. Final answer

- **Is worker email/phone currently reachable by an anonymous visitor? YES.**
- **What triggers it:** the visitor entering a ZIP code in `ZctaLocationInput` inside the booking flow's location step (guest checkout, before signup/login).
- **Rendered in UI?** No — the frontend strips those fields before display.
- **Wire-visible?** Yes — response payload contains `email` and `phone` for every active worker returned by `findAvailableWorkersWithAreaInfo` for that ZIP.
- **Dead code note:** `zctaServiceOptimized.ts:63` is unreferenced; it is not part of any live anon path (and not part of any live authenticated path either).

### Suggested (not yet applied) mitigations for later discussion

1. Change the `findAvailableWorkersWithAreaInfo` select list from `id, name, email, phone` to `id, name` (email/phone are already discarded by the only caller that reaches anon). Zero UI impact.
2. Additionally / alternatively, tighten the `users` RLS anon policy so anon SELECT on `role='worker'` returns only non-PII columns, or move worker discovery behind an edge function / SECURITY DEFINER RPC.
3. Delete `zctaServiceOptimized.ts` in a cleanup pass (unrelated to RLS scope but eliminates a confusing duplicate query pattern).

No changes will be made until you approve the mitigation approach.
