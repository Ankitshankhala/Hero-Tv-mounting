## Discount Applied Banner

Create a dismissible promotional banner that communicates "20% off is already applied in price" to customers browsing the homepage.

### What to Build

1. **New Component**: `src/components/promo/DiscountAppliedBanner.tsx`
   - Fixed message: "20% off is already applied in price" 
   - Dismissible with localStorage persistence (so it stays hidden after user closes it)
   - Styled using the existing dark theme design system (slate/blue gradient)
   - Responsive: full-width on desktop, compact on mobile
   - Uses semantic design tokens (no hardcoded colors)

2. **Placement**: Add the banner to `src/pages/Index.tsx` — positioned between the Header and the ServicesSection so it's visible when customers view service prices.

### Design Details
- Gradient background matching the existing promo banner style (blue-600 to indigo-600)
- White text with a badge/tag icon
- Dismiss button (X) on the right
- Smooth mount animation (same pattern as PromoBanner)
- No database or backend changes required — this is a pure frontend UI component

### Out of Scope
- No actual price reduction logic (database prices remain unchanged)
- No coupon code or checkout integration
- No changes to existing PromoBanner or MobilePromoBar