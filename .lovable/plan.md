# Diagnosis — Worker "Add Service" broken after recent services changes

## 1. Component ownership (worker-facing)

- **Entry component:** `src/components/worker/AddServicesModal.tsx` — opened from a job card via the "Add Services" action. This is the worker-panel add-service UI.
- **Supporting components:**
  - `src/components/TvMountingModal.tsx` — opens when worker clicks the "Mount TV" tile (Mount TV is not added directly; it's configured first).
  - `src/components/ServiceCard.tsx` — tile renderer.
  - `src/components/worker/invoice/AddServicesTab.tsx` — a separate invoice-modification variant used inside `EnhancedInvoiceModificationModal`, not the main flow.
- **Not involved (admin-only):** `src/components/admin/ServiceModal.tsx`, `src/components/admin/services/*`, `src/hooks/useServicesData.tsx`. `ServicesManager.tsx` does not exist in this project.
- **Backend:** `supabase/functions/add-booking-services/index.ts` → delegates to `payment-engine` (`recalculate` or `charge-difference`).

## 2. Schema / type audit

`booking_services` table columns (queried live):

```
booking_id uuid NOT NULL
service_id uuid NOT NULL
service_name text NOT NULL
base_price numeric NOT NULL default 0
quantity int NOT NULL default 1
configuration jsonb default '{}'
```

The insert in `add-booking-services/index.ts` (lines 59–67) maps exactly these columns — **no schema mismatch on `booking_services`**.

`services` table read (line 45): selects `id, base_price, name` with `.in('id', serviceIds)` — matches current schema. No missing columns.

Frontend `PublicService` interface (`usePublicServicesData.tsx`) matches selected columns including the newly added `pricing_config` jsonb.

**No column-not-found or type-mismatch signature is present in the code paths.**

## 3. Recent related edits

Last three commits touching this area:

- `7a584900` — `AddServicesModal.tsx` (+11 lines) — small UI addition.
- `dfc1b218` — `AddServicesModal.tsx` (+4/-2) — minor.
- `29e72f7c` — `AddServicesModal.tsx`, `ReauthorizePaymentDialog.tsx`, `add-booking-services/index.ts` (+9), plus a migration `..._049d18d4...sql`. This introduced the 3DS reauthorization handoff (`action`, `client_secret`, `old/new_payment_intent_id` in the response, and forwarding `Authorization` header to `payment-engine`).

Earlier work also introduced the Mount TV **tiered `pricing_config`** (`1st $90 / 2nd $80 / additional $70`) on the `services` row `a50013bc-...`. `has_config=true` confirmed in DB.

## 4. Root-cause candidates (no runtime error captured — no repro provided, no edge-function logs, no console logs on file)

Ranked by likelihood based on the recent change surface:

### A. Mount TV tiered pricing is ignored on the worker add path (most likely)

- The worker modal computes price with `getEffectiveServicePrice(service.base_price, isTestingMode, cart.length)` — it passes `base_price` only. The tier table in `pricing_config.tiers` is never consulted.
- `add-booking-services/index.ts` also uses only `services.base_price` (lines 44–67). Any Mount TV added by a worker is priced at flat $90 × qty, ignoring the $80 / $70 tiers.
- If the customer already has 1 Mount TV on the booking and the worker adds another, the recalculation via `payment-engine` compares against the tiered total and will disagree with the flat sum — this can trigger a `recalculate` mismatch/failure in `payment-engine` and surface as "Service Addition Failed" in the toast.
- Frontend `TvMountingModal` handles tiers for the customer-flow, but that logic is duplicated/omitted here for the worker path.

### B. `is_visible = false` add-ons cannot be added standalone

- `usePublicServicesData` filters `is_visible = true`. Add-on rows (`Over 65"`, `Frame Mount Add-on`, `Brick/Steel/Concrete`, `Frame Mount Add-on`, etc.) are `is_visible=false`. They only reach the worker via `TvMountingModal`. If a worker expects to see them directly in the Add-Services grid, they won't. Not a bug per se, but a plausible "add service doesn't work" complaint.

### C. `payment_status='captured'` guard blocks addition

- `handleAddServicesAndCharge` (line 121) short-circuits when `payment_status === 'captured'`. Post-completion bookings intentionally cannot receive new services from this modal. If a worker sees "Cannot Add Services" this is the reason and is by design.

### D. Auth header propagation

- `29e72f7c` added `Authorization: Bearer ${session?.access_token ?? ''}` (line 162). If the session is stale/expired, `payment-engine`'s `validateAuth()` rejects and the modal shows a generic "Service Addition Failed". No refresh-then-retry exists.

### E. Missing background functions

- `add-booking-services` fires `update-invoice` and `send-increment-notification` via `EdgeRuntime.waitUntil`. If either edge function isn't deployed (the earlier session hit the "max Edge Functions" limit), it fails silently in background — will NOT break the add flow itself, but will produce error logs and stale invoices.

## 5. What is NOT verified yet

- No console/network log or edge-function log for `add-booking-services` was captured this session. To confirm A vs D, we need one of:
  1. The exact toast text + `error_code` the worker sees.
  2. `add-booking-services` invocation logs from Supabase for a failing attempt.
  3. Reproduction via Playwright with a signed-in worker adding a service to an authorized (non-captured) booking.

## Recommended next step (still no code change)

Ask the user for the failing job's `payment_status` and the exact error toast, or run a Playwright repro against the worker dashboard to capture the network response body from `functions/v1/add-booking-services`. That will disambiguate A (tier/amount mismatch surfacing from `payment-engine`) from D (auth) or C (captured guard).
