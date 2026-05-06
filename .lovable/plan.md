# payment-engine: add validateMountTvAddOns to 4 unguarded handlers

## Confirmation of your checks
- **complete-and-capture**: verified `getServicesTotal(bookingId)` is called only once in that handler (L832). No duplicate round-trip — single insertion above it is correct.
- **recalculate without Mount TV**: `validateMountTvAddOns` exits early when no Mount TV line items are found, so calling it unconditionally is safe.
- **refund-difference**: skipped — already validates per-line against `services` table (L1018–1054).

## Edits (all in `supabase/functions/payment-engine/index.ts`, single line inserted before each existing line)

### 1. `recalculate` handler — insert before L346
```ts
await validateMountTvAddOns(bookingId);
const servicesTotal = await getServicesTotal(bookingId);
```
Variable: `bookingId` (destructured L327). Guards `paymentIntents.create` (L442/470), `cancel` (L559), `refunds.create` (L633).

### 2. `complete-and-capture` handler — insert before L832
```ts
await validateMountTvAddOns(bookingId);
const servicesTotal = await getServicesTotal(bookingId);
```
Variable: `bookingId` (destructured L770). Guards `paymentIntents.capture` (L857).

### 3. `charge-difference` handler — insert before L968
```ts
await validateMountTvAddOns(bookingId);
const servicesTotal = await getServicesTotal(bookingId);
```
Variable: `bookingId` (destructured L955). Guards `handleChargeDifference` → `paymentIntents.create` (L1257).

### 4. `finalize-reauthorization` handler — insert before L1116
```ts
await validateMountTvAddOns(bookingId);
const newPI = await stripe.paymentIntents.retrieve(new_payment_intent_id);
```
Variable: `bookingId` (destructured L1091). Guards acceptance of the swapped-in PI before it becomes the capture authority.

## Constraints honored
- Only `payment-engine/index.ts` modified.
- `validateMountTvAddOns` itself untouched.
- No other handler logic changed; each edit is one new line.
- All insertions reuse the existing `bookingId` local — no renames.
- `authorize` (L199) and `capture` (L685) already guarded — not duplicated.

## Post-deploy
Edge function will redeploy automatically. Suggest a quick smoke test of the `recalculate` path on a booking that contains Mount TV add-ons to confirm the guard fires correctly when prices match and rejects when manipulated.
