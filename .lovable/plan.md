

# Fix: Coupon Creation and Validation System

## Root Cause Analysis

There are **two connected issues** that make the entire coupon system non-functional:

### Issue 1: Coupons Cannot Be Created (Primary Blocker)

The database has a CHECK constraint called `percentage_has_max_discount`:

```
CHECK (discount_type <> 'percentage' OR max_discount_amount IS NOT NULL)
```

This means: **every percentage coupon MUST have a `max_discount_amount` value**. But the Create Coupon form (line 163) labels this field as "Optional" and allows it to be left blank. When the admin submits without it, the database rejects the insert with:

```
"new row for relation "coupons" violates check constraint "percentage_has_max_discount""
```

This is the exact error visible in the console logs right now.

### Issue 2: NaN Warning in the Form

When a number input is cleared (empty string), `parseFloat('')` returns `NaN`, which React passes as the input's `value` attribute, producing the console error:

```
Warning: Received NaN for the `value` attribute.
```

This affects `discount_value` and `min_order_amount` fields.

### Issue 3: Validation During Booking

The `validate-coupon` edge function and `is_coupon_valid` database function are actually correct. The reason validation "doesn't work" during booking is simply that **no valid coupons can be created** due to Issue 1. The existing HERO10 coupon expired on 2025-11-15, so it fails the date check.

---

## The Fix

### File 1: `src/components/admin/CreateCouponModal.tsx`

**Change A - Make `max_discount_amount` required for percentage coupons:**
- Remove the "Optional" placeholder when discount type is percentage
- Add `required` attribute when discount type is percentage
- Auto-set a sensible default or show a clear validation message
- When switching from percentage to fixed, clear `max_discount_amount`

**Change B - Fix NaN on empty number inputs:**
- Guard all `parseFloat()` / `parseInt()` calls with fallback to 0 or undefined
- For `discount_value`: `parseFloat(e.target.value) || 0`
- For `min_order_amount`: `parseFloat(e.target.value) || 0`
- For `max_discount_amount`: keep as `undefined` when empty (for fixed type), but require a value for percentage type

**Change C - Add client-side validation before submit:**
- If `discount_type === 'percentage'` and `max_discount_amount` is empty/undefined, show a toast error and prevent submission
- Validate `discount_value > 0`
- Validate `valid_until > valid_from` (mirrors DB constraint `valid_date_range`)

**Change D - Add missing DialogDescription for accessibility:**
- Fix the console warning: `Missing Description or aria-describedby for DialogContent`

### No Edge Function or Database Changes Needed

- The `validate-coupon` edge function is correct
- The `is_coupon_valid` database function is correct
- The CHECK constraints are sensible (percentage coupons SHOULD have a max cap)
- The form just needs to enforce what the database already requires

---

## What This Fixes

| Problem | Before | After |
|---|---|---|
| Creating percentage coupon | Fails silently with DB error | Form requires max discount amount, validates before submit |
| NaN warning in console | Shows on every cleared number input | Properly handles empty inputs |
| Coupon validation at booking | No valid coupons exist to test | Admin can create valid coupons, which then validate correctly at checkout |
| Accessibility warning | Missing DialogDescription | Added proper description |

## Files to Change

| File | Change |
|---|---|
| `src/components/admin/CreateCouponModal.tsx` | Make max_discount_amount required for percentage type, fix NaN handling, add client-side validation, add DialogDescription |

