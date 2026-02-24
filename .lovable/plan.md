

# Fix: Coupon Table Not Updating After Creation

## Root Cause

`CouponsManager` and `CreateCouponModal` each instantiate their own `useCoupons()` hook. These are **separate React state instances** -- they don't share data.

```text
CouponsManager
  useCoupons() --> coupons state A (displayed in table)
  
CreateCouponModal  
  useCoupons() --> coupons state B (never displayed)
```

When `createCoupon()` runs inside the modal, it calls `fetchCoupons()` internally -- but that updates state B (the modal's copy), not state A (the table's copy). The `onSuccess` callback only calls `loadAnalytics()`, so the analytics card updates but the table never refreshes.

## The Fix

**File: `src/components/admin/CouponsManager.tsx`**

One line change: include `fetchCoupons` in the `onSuccess` callback passed to `CreateCouponModal` and `EditCouponModal`.

1. Destructure `fetchCoupons` from the `useCoupons()` hook in `CouponsManager` (line 21)
2. Update the `onSuccess` for `CreateCouponModal` (line 267) to call both `fetchCoupons` and `loadAnalytics`
3. Update the `onSuccess` for `EditCouponModal` (line 279) to also call `fetchCoupons`

### Technical Detail

```text
BEFORE (line 21):
  const { coupons, loading, toggleCouponStatus, deleteCoupon, fetchCouponAnalytics } = useCoupons();

AFTER (line 21):
  const { coupons, loading, fetchCoupons, toggleCouponStatus, deleteCoupon, fetchCouponAnalytics } = useCoupons();

BEFORE (line 267):
  onSuccess={loadAnalytics}

AFTER (line 267):
  onSuccess={() => { fetchCoupons(); loadAnalytics(); }}

BEFORE (line 279):
  onSuccess={loadAnalytics}

AFTER (line 279):
  onSuccess={() => { fetchCoupons(); loadAnalytics(); }}
```

This ensures the parent component's coupon list refreshes immediately after any creation or edit, so the table always shows the latest data.

## No Other Files Need Changes

- `useCoupons.ts` already exposes `fetchCoupons` -- it just wasn't being used in `CouponsManager`
- `CreateCouponModal` already calls `onSuccess()` after successful creation
- No database or edge function changes needed

