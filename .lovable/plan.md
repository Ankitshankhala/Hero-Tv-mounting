# Goal

When a worker adds services to a booking and the saved card needs reauthorization, the Stripe authorization UI must reliably open and complete the 3DS challenge against the saved card — without forcing the worker to re-enter card details, and without leaving bookings stranded in `requires_manual_payment`.

# Current Behavior (verified)

`AddServicesModal.handleAddServicesAndCharge` → `add-booking-services` → `payment-engine` action `recalculate`.

When the saved card needs customer action, `payment-engine` already creates a fresh PI and returns:
```
{ action: 'requires_customer_action', client_secret, new_payment_intent_id, old_payment_intent_id, old_amount, new_amount }
```
`add-booking-services` forwards these. The modal opens `ReauthorizePaymentDialog` with `client_secret`.

# Problems Found

1. `ReauthorizePaymentDialog` mounts a NEW Stripe `card` element and calls `stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } })`. This **overrides the saved card** that was attached to the pending PI and forces the worker to re-type card details. That is not "opening the Stripe authorization UI for the saved card" — it is a fresh card collection. It also doesn't show a 3DS challenge for the saved card.
2. There is no branch for `action: 'requires_manual_payment'` (returned by `payment-engine` when no `stripe_customer_id`/`stripe_payment_method_id` exists, or after a hard failure). The modal silently hits the success path, the booking is flagged `requires_manual_payment=true`, and the worker has no recovery UI.
3. Worker-initiated 3DS on a customer's saved card cannot complete on the worker's device — only the cardholder can pass the challenge. UX must reflect that.

# Plan

## 1. Fix `ReauthorizePaymentDialog` to actually trigger Stripe's 3DS UI on the saved card

- Stop mounting a new `<card>` element. Stop passing `payment_method: { card: ... }`.
- Call `stripe.handleNextAction({ clientSecret: client_secret })`. This is Stripe's official method to open the saved-card 3DS modal for an already-confirmed PI in `requires_action` state.
- If Stripe returns an error or the PI ends in any state other than `requires_capture`, surface the failure clearly and keep the dialog open so the worker can retry or cancel.
- Rename the dialog title/copy to "Customer Authorization Required" and show: "The customer's card requires 3D Secure verification for the new amount. Complete the challenge on this device, or send the customer a link."
- Replace card-entry UI with a single primary button "Open Stripe Authorization" that calls `handleNextAction`, plus a secondary "Send Customer a Link" button (calls a new edge-function action — see step 3).
- On success: same flow as today (call `payment-engine` action `finalize-reauthorization`).

## 2. Handle `requires_manual_payment` in the modal

In `AddServicesModal.handleAddServicesAndCharge`, after the success guard add:
```
if (data.action === 'requires_manual_payment') {
  toast({ title: 'Manual Payment Required',
          description: 'No saved card on file. Send the customer a payment link to authorize the new amount.',
          variant: 'destructive' });
  // Optionally open a "Send Payment Link" dialog (deferred — out of scope of this fix).
  return;
}
```

## 3. Add a "Send Customer Authorization Link" path (lightweight)

- New `payment-engine` action `send-reauth-link`: takes `{ bookingId, new_payment_intent_id }`, creates a short signed URL (uses existing payment-link infra in `create-payment-link` if available — verify), and triggers `unified-email-dispatcher` + `send-sms-notification` to the customer.
- Wire the secondary "Send Customer a Link" button in `ReauthorizePaymentDialog` to this action and toast "Authorization link sent to customer."

If the `create-payment-link` infra cannot be reused 1:1, fall back to emailing the customer with a deep link to `/customer/dashboard` highlighting the pending authorization (booking already exposes `pending_payment_amount` in the customer dashboard).

## 4. Clean up

- Remove the unused `cardElement`/`stripe` Elements mount logic from `ReauthorizePaymentDialog`.
- Keep `RemoveServicesModal` parity: same dialog behavior applies to the remove flow since it shares `ReauthorizePaymentDialog`.

# Files Touched

- `src/components/worker/payment/ReauthorizePaymentDialog.tsx` — replace card-element flow with `stripe.handleNextAction`; add "Send Link" button.
- `src/components/worker/AddServicesModal.tsx` — handle `requires_manual_payment` action explicitly.
- `supabase/functions/payment-engine/index.ts` — add `send-reauth-link` action (small handler that emails/SMSes the customer with a link to authorize).

# Test Checklist

1. Add services to a booking whose saved card triggers `authentication_required` → modal opens → "Open Stripe Authorization" → Stripe 3DS popup appears → complete challenge → toast "Payment Re-authorized" → booking `payment_status='authorized'` and `payment_intent_id` swapped to new PI.
2. Add services where off-session reauth succeeds (no 3DS) → no modal, only success toast.
3. Add services for a booking with no saved payment method → toast "Manual Payment Required" → no orphan services (rollback verified).
4. Click "Send Customer a Link" in the dialog → customer receives email/SMS with link → worker dialog closes with "Link sent" toast → booking remains in `pending_payment_amount` state until customer completes.
5. Cancel dialog mid-flow → pending PI remains; no DB swap occurs (engine still requires `finalize-reauthorization`).
6. Repeat 1–3 for `RemoveServicesModal` to confirm shared dialog parity.

# Out of Scope

- Building a full "Send Customer Link" recovery dashboard (we only add the trigger + email/SMS).
- Migrating away from `pending_payment_amount` semantics.
