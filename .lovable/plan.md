# Deploy read-only Stripe diagnostic

## What I'll do (Option A, committed)
1. Create `supabase/functions/stripe-diagnostics/index.ts` — a temporary read-only edge function that:
   - Reads `STRIPE_MODE` and the matching secret key (already present in project secrets).
   - Calls `stripe.paymentIntents.list({ created: { gte, lte } })` for the window **2026-07-06 00:00Z → 2026-07-09 23:59Z**, paginating up to 500 PIs.
   - Calls `stripe.customers.list({ email })` for each of the 7 emails from the stuck bookings.
   - Returns a JSON report: PI id, created timestamp, status, amount, `receipt_email`, `customer`, `last_payment_error` (code/decline_code/message), and any matching Stripe customer rows.
2. Invoke it once via `supabase--curl_edge_functions` with the email list.
3. Report the raw findings: for each of the 10 stuck bookings, whether Stripe has any PI or Customer for the same email in that window, and if so its status/error.
4. **Delete** the diagnostic function immediately after (via `supabase--delete_edge_functions`) so it doesn't linger in prod.

## Guarantees
- Read-only Stripe calls (`list`) — no creates, updates, captures, or refunds.
- Uses existing `STRIPE_SECRET_KEY` from project secrets, honors current `STRIPE_MODE=live`.
- No changes to any existing file. One new file added, then removed.
- No frontend code touched.
- No database writes.

## Emails covered
`holdenkmaples@gmail.com`, `marksammy85@gmail.com`, `dhamizg@gmail.com`, `doug.shald@gmail.com`, `katemabarbra8@gmail.com`, `rodrigopradobrandao@gmail.com`, `abc@gmail.com`.

## Exit criteria
Report tallies the 10 bookings into:
- Never reached Stripe (no PI, no Customer)
- Reached Stripe, PI exists — with its status and `last_payment_error`
- Customer created in Stripe but no PI (partial handoff)

Then I delete the diagnostic function and hand back with recommendations for the actual fix scope.
