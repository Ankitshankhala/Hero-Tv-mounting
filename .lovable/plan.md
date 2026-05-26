# Verify Guest Checkout End-to-End

Drive the live preview as a guest and confirm every stage of the booking + payment flow works, then report findings.

## Steps

1. **Enable testing mode** (so all services are $1 and we don't authorize a real customer amount). Confirmed admin-only via existing memory rule.
2. **Open preview as guest** (signed out, fresh session) at `/`.
3. **Walk the booking flow:**
   - Add a TV mounting service to cart
   - Enter a known-good ZIP (one present in `service_zipcodes`, e.g. one used by booking `e8dc1296`)
   - Pick a date/time slot
   - Enter guest contact info (name, email, phone with SMS consent checkbox)
   - Reach the payment step
4. **Authorize with Stripe test card** `4242 4242 4242 4242`.
5. **Capture signals at each step:**
   - Console errors
   - Network: `POST /unified-payment-authorization` status + latency
   - Final booking row in DB: `payment_status`, `payment_intent_id`, `guest_customer_info`, `status`
   - `confirm-payment` invocation + invoice generation
   - Email dispatch logs (customer + worker)
6. **Report:** pass/fail per stage, with any console/network/DB anomaly highlighted. If anything fails, isolate to one of: ZIP gate, session/cart state, Stripe Elements mount, `createPaymentMethod`, edge function, or post-auth side effects.

## What this does NOT change
- No code edits
- No DB migrations
- No secret changes
- Testing mode flag is toggled back off at the end

## Expected outcome
Either a clean green run (matching `e8dc1296`) confirming guest checkout is healthy, or a precise failure signature that points to the exact file/function to fix in a follow-up build.