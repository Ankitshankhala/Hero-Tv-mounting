# Duplication Audit — findings only, no fixes

Ranked by risk. "Drifted" = copies already behave differently, so a live bug likely exists. "Identical" = same logic in multiple places, safe to consolidate but a landmine (updating one and forgetting the others is exactly the tiered-pricing bug pattern).

---

## 1. DRIFTED — `getEffectiveServicePrice` exists as 3 different functions with the same name

Highest risk. This is the same class of bug you already hit.

- `supabase/functions/_shared/pricing.ts` — signature `(config, quantityIndex)`, uses `config.tiers[min(idx, len-1)]`. Server-authoritative, used by `add-booking-services`.
- `src/lib/pricing/getEffectiveServicePrice.ts` — byte-identical copy of the above. Frontend twin.
- `src/utils/pricingEngine.ts` line 102+ — completely different implementation: `(service, quantity)`, uses `tiers.find(t => t.quantity === quantity)`, falls back to `is_default_for_additional`, then last tier, then `base_price`. Different lookup semantics (exact-match vs index-clamp), different fallback chain.
- `src/contexts/TestingModeContext.tsx:95` — a fourth `getEffectiveServicePrice(originalPrice, isTestingMode, lineIndex)` overrides prices entirely in testing mode. Unrelated signature, same exported name — namespace collision waiting to mislead a future edit.

**Live inconsistency risk:** any code path importing `pricingEngine.getServicePriceForQuantity` will price differently from `_shared/pricing.ts` when the tiers array isn't ordered 1..N contiguously, or when quantity exceeds defined tiers without `is_default_for_additional` set. `payment-engine` reconciles server-side, so the visible symptom is a client/server total mismatch surfacing as a checkout error, not a silent overcharge — but it is drift.

## 2. DRIFTED — discount application math is reimplemented client-side in 4 places

`validate-coupon` edge function only returns `discount_amount` from a DB RPC. Every subtotal→final-total computation happens client-side:

- `src/utils/couponCalculation.ts` — `applyCouponToCart` clamps at 0 (`Math.max(0, cartTotal - discount)`).
- `src/hooks/booking/useBookingFormState.ts:62,67` — clamps at 0 via `Math.max(0, discountedSubtotal)`. Matches util.
- `src/components/checkout/CheckoutActions.tsx:35` — `total - appliedCoupon.discountAmount`. **No zero clamp.** Renders negative totals if discount > subtotal.
- `src/components/EmbeddedCheckout.tsx:237` — same as CheckoutActions, no clamp.

**Live inconsistency:** the form-state hook and CheckoutActions can display different "final totals" for the same cart when a fixed-discount coupon exceeds subtotal. Stripe-side is protected (payment-engine recomputes), but the confirm button label and the price the user thinks they're paying can disagree. Also: `couponCalculation.ts` exists but is not imported by any of the three consumers above — dead canonical util.

## 3. DRIFTED — phone formatting has two disagreeing canonical utils

- `src/utils/validation.ts:25` `formatPhoneNumber` — display format `(XXX) XXX-XXXX` or `+1 (XXX) XXX-XXXX`. Used by `ValidatedInput`.
- `src/utils/phoneUtils.ts:9` `formatPhoneForTel` — E.164 format `+1XXXXXXXXXX`. Used for `tel:` links.
- Edge functions `send-customer-sms-notification`, `send-sms-notification`, `send-customer-booking-confirmation-email` each reimplement `phone.replace(/\D/g, '')` inline with their own normalization branches (SMS functions do E.164-ish, one email function has it twice in the same file at lines 23 and 42).

These serve different purposes so drift is expected, but the **4 inline copies in edge functions** are the risky part — no shared `_shared/phone.ts` exists, so a future E.164 rule change (e.g. handling +44) has to be made in 4+ places.

## 4. IDENTICAL (but scattered) — `zipcode.replace(/\D/g,'').slice(0,5)` in 10+ files

Canonical `cleanZip` exists in `src/utils/zip.ts` and is exported alongside `isValidZip`/`assertValidZip`. Yet inline copies live in:

`src/hooks/useZipcodeValidation.ts:27`, `src/hooks/useOptimizedZipcodeValidation.ts:30`, `src/services/optimizedZipcodeService.ts:141`, `src/utils/zipcodeValidation.ts:116,191,261`, `src/components/ZipcodeInput.tsx:57`, `src/components/EnhancedZipcodeInput.tsx:57`, `src/components/ZipcodeLocationInput.tsx:85`, `src/components/admin/AdminZipCodeManager.tsx:121`, `src/components/admin/AdminWorkerCoverageModal.tsx:188`. Plus ad-hoc `/^\d{5}$/` regex in `src/lib/mcp/tools/check-service-area.ts` and `src/services/reverseGeocodingService.ts:112`.

All currently identical behavior. No live bug — but if you ever need to accept ZIP+4 or normalize differently, you have 12 edit sites.

Email regex has only one home (`src/utils/validation.ts` `ValidationPatterns.email`) — clean. No signup/checkout/admin form was found reimplementing email format checks.

## 5. IDENTICAL — `America/Chicago` timezone hardcoded in 5+ files instead of using `DEFAULT_SERVICE_TIMEZONE`

`src/utils/timeUtils.ts` exports `DEFAULT_SERVICE_TIMEZONE = 'America/Chicago'`, but consumers hardcode the string:

- `src/hooks/booking/useWorkerAvailability.ts:30,56,57,58` — 4 usages
- `src/hooks/booking/useZctaWorkerAvailability.ts:37,83,84,85` — 4 usages, near-identical block of `formatInTimeZone(...) / toZonedTime(new Date(), 'America/Chicago')` to compute "today in Chicago". These two hooks are essentially the same "is this slot in the past?" logic duplicated.
- `src/components/booking/ScheduleStep.tsx:49`, `src/components/booking/CalendarView.tsx:131` — same `nowInChicago = toZonedTime(new Date(), 'America/Chicago')` idiom, no shared helper.

`src/utils/dateHelpers.ts` also defines its own `getDayOfWeek` returning lowercase strings, while `useWorkerAvailability` and `useZctaWorkerAvailability` each call `format(date, 'EEEE')` inline to get capitalized day names for a DB enum lookup — a third variant.

**Live risk:** if the business ever operates outside Central Time, or DST edge cases surface, five files need coordinated edits. No current-behavior bug detected — all copies use the same string.

---

## Also noted (single-owner, no duplication concern)

- **Tax calculation** — only in `supabase/functions/generate-invoice/index.ts`, `update-invoice/index.ts`, and `worker-remove-services/index.ts`, all reading `tax_rate` from the invoice row and doing `subtotal * tax_rate`. Same formula in each, driven by DB value. No client-side tax math. ✅ single owner.
- **Refund amount** — only `admin-process-refund` and `payment-engine` compute refund amounts server-side. Clients pass amounts, don't calculate. ✅
- **Cancellation fee** — no computation exists in code. Referenced only in `TermsOfService.tsx` copy and DB column definitions. Feature not implemented; nothing to duplicate.
- **Worker earnings** — single implementation in `src/utils/workerEarningsCalculator.ts`. ✅
- **Base-price × quantity subtotal** — recomputed in ~8 edge functions (`payment-engine`, `add-booking-services`, `worker-remove-services`, `create-payment-intent`, `sync-authorized-bookings`, `repair-tip-calculations`, `generate-invoice`, `validate-booking-integrity`). All identical (`sum + base_price * quantity`). Low risk today, but no `_shared/subtotal.ts` exists — same landmine pattern as pricing.

---

## Suggested Phase-2 priority (for your approval, no edits yet)

1. **Consolidate `getEffectiveServicePrice`** — pick one algorithm (`_shared/pricing.ts` index-clamp is the one the server enforces), delete `src/lib/pricing/getEffectiveServicePrice.ts` in favor of re-exporting the shared logic, and reconcile or rename `pricingEngine.getServicePriceForQuantity` so the exact-match variant can't be confused with the canonical one. Rename the testing-mode helper to remove the name collision.
2. **Add zero-clamp to CheckoutActions + EmbeddedCheckout** or route both through `useBookingFormState`'s already-clamped total. Import `applyCouponToCart` from `couponCalculation.ts` at all four sites so one file owns the rule.
3. **Extract `nowInChicago` / `todayInServiceTz` / `dayOfWeekEnum` helpers** into `timeUtils.ts` and replace the ~10 hardcoded `'America/Chicago'` sites.
4. **Add `supabase/functions/_shared/phone.ts` and `_shared/subtotal.ts`** so future edge functions have one place to import from.
5. Route all inline `replace(/\D/g,'').slice(0,5)` sites through `cleanZip` — mechanical, low-risk.

Awaiting approval before making any changes.
