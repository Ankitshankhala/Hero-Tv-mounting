# Public Coupon Promotion System

Surface active coupons from the existing `coupons` table across the public site with copy-to-clipboard, dismiss memory, and seamless auto-apply into the existing checkout `CouponSection`.

## Scope

In: Public-facing display only. Reuses existing `coupons` table, `useCoupons` hook, and `CouponSection` checkout logic.
Out: New tables, admin changes, exit-intent popup (skipping to stay non-intrusive — can add later), email/SMS, real-time websocket sync (uses 5-min React Query stale time already configured).

## Components to build

1. **`src/hooks/usePublicCoupons.ts`**
   - Anon-friendly query against `coupons` (RLS already allows public read of active/valid).
   - Filters: `is_active=true`, `valid_from<=now()`, `valid_until>=now()`, and `usage_limit_total IS NULL OR usage_count < usage_limit_total`.
   - Sort: highest `discount_value` first (percentage weighted), then nearest expiry.
   - Returns `{ coupons, primary, loading }`.

2. **`src/components/promo/PromoBanner.tsx`** — sticky top announcement bar
   - Rendered once in `App.tsx` above `<Router>` content, outside `<Header>`'s sticky offset (or inside layout above header so it pushes content).
   - Displays primary coupon: emoji + "Save {X}% OFF with code **HERO20**" + "Max ${max}" pill + expiry countdown if <7 days.
   - Buttons: **Copy code** (clipboard + toast), **Apply Now** (navigates to `/#services` with `?coupon=HERO20` query param), **X** dismiss.
   - Dismiss persists per-coupon-id in `localStorage` key `promo_dismissed_v1` (array of IDs); re-shows when admin publishes a new coupon.
   - Slide-down framer-motion entrance, gradient bg using existing primary tokens, rounded-none full-width.

3. **`src/components/promo/HeroPromoStrip.tsx`** — inline card under the hero section on homepage
   - Larger card variant with subtle glow/gradient, lists up to 2 active coupons.
   - "Copy" + "Book Now" CTAs.

4. **`src/components/promo/MobilePromoBar.tsx`** — fixed bottom strip on mobile only (`md:hidden`)
   - Compact one-line: "HERO20 — 20% OFF" + Copy icon + dismiss.
   - Hidden when the booking flow modal is open (check existing modal context or use route awareness).

5. **`src/components/promo/CheckoutPromoReminder.tsx`** — small card inside checkout, shown only when no coupon applied yet
   - Lists available codes; clicking one calls into existing `CouponSection` apply handler (pass via prop / lift state).

## Auto-apply wire-up

- `PromoBanner` "Apply Now" sets `?coupon=CODE` in URL.
- In booking flow entry (`EnhancedInlineBookingFlow` or `useBookingFormState`), read `searchParams.get('coupon')` on mount and prefill the coupon input, triggering existing validation.

## Visual direction

Reuse semantic tokens from `index.css`: primary blue accent on slate background, white text, gradient `from-primary to-primary/80`, subtle ring. No new colors. Inter/Inter Tight per design memory. Smooth framer-motion fade/slide; no flashy popups.

## File changes

```text
NEW  src/hooks/usePublicCoupons.ts
NEW  src/components/promo/PromoBanner.tsx
NEW  src/components/promo/HeroPromoStrip.tsx
NEW  src/components/promo/MobilePromoBar.tsx
NEW  src/components/promo/CheckoutPromoReminder.tsx
EDIT src/App.tsx                          → mount PromoBanner + MobilePromoBar globally
EDIT src/pages/Index.tsx                  → insert HeroPromoStrip below hero
EDIT src/components/EmbeddedCheckout.tsx  → render CheckoutPromoReminder above CouponSection
EDIT src/hooks/booking/useBookingFormState.ts → read `?coupon=` and prefill
```

## Technical notes

- Public read of `coupons` already allowed by RLS policy `Public can view active valid coupons`.
- No backend or DB changes.
- Dismissal stored only in `localStorage` (per-device); resets when coupon ID changes.
- Countdown only renders when `valid_until - now < 7 days` to avoid noise.
- All four surfaces share the same `usePublicCoupons` query (React Query dedupes).
