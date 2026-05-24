# Stripe Card Acceptance — Fix Plan

## Root cause (most important)

After auditing the code, the gateway integration itself is **correctly built**:

- `StripeCardElement` uses Stripe's official `card` Element, which automatically accepts every card brand enabled on your Stripe account (Visa, Mastercard, Amex, Discover, Diners, JCB, UnionPay, international debit/credit).
- PaymentIntents are created with the customer's attached payment method via `payment-engine` / `unified-payment-authorization` and use `capture_method: 'manual'` (auth-only, captured later). No `payment_method_types` restriction is hardcoded, so Stripe falls back to its account-level defaults.
- The publishable key in `.env` is a `pk_live_…` key and the mode toggle (`VITE_STRIPE_MODE` / `STRIPE_MODE`) is wired correctly.

**This means card rejections you're seeing are almost certainly Stripe Dashboard configuration**, not a bug in this codebase. The Dashboard items below are not something I can change from code — you'll need to confirm them in your Stripe account. Then I'll ship a set of code-side improvements that reduce the *remaining* rejections (better AVS, clearer errors, visible card-brand support, 3DS handling).

## Part A — Stripe Dashboard checklist (you do this)

In https://dashboard.stripe.com:

1. **Settings → Payment methods → Cards** — confirm each brand is toggled ON for the live account:
   - Visa, Mastercard, American Express, Discover, Diners Club, JCB, UnionPay.
   - Amex/Discover/Diners/JCB are sometimes off by default on new accounts.
2. **Settings → Payments → Radar rules** — review any custom rules blocking international BINs, prepaid cards, or specific countries. The default rule set will block obvious fraud but should not reject normal foreign cards.
3. **Settings → Payments → Card processing → International payments** — make sure "Accept international cards" is enabled.
4. **Settings → Business → Public details → Country** — confirm account country is US (matches the `currency: 'usd'` we send).
5. **Webhooks** — confirm `charge.failed`, `payment_intent.payment_failed`, `payment_intent.requires_action` are subscribed if you want to track declines.

Send me a screenshot of Settings → Payment methods if you'd like me to verify. Once these are confirmed, the code changes below will handle the rest.

## Part B — Code-side improvements (I'll implement)

### 1. Better AVS / international acceptance in `StripeCardElement`

- Remove `hidePostalCode: true`. Postal code → AVS check → fewer false declines for both US and international cards. The Card Element auto-localizes the label ("ZIP" in US, "Postcode" in UK, etc.).
- Add `disableLink: false` (already default) but pass account-level Stripe config for Link autofill — improves checkout completion.

### 2. Visible card-brand support row

- New small component `AcceptedCardsRow` rendered above the card field in `SimplePaymentAuthorizationForm`, `PaymentAuthorizationForm`, `SecurePaymentForm`, and `InlineStripePaymentForm`. Uses inline SVG/emoji-free brand marks (Visa, Mastercard, Amex, Discover, Diners, JCB) + a small "Secured by Stripe · 256-bit SSL" trust line with a lock icon. Pure presentational, no logic.

### 3. Expand decline error mapping in `getErrorMessage`

In `SimplePaymentAuthorizationForm.tsx` (and the equivalent helper used by `PaymentAuthorizationForm`/`SecurePaymentForm`), add explicit user-friendly messages for the most common Stripe decline codes that are currently falling through:

| Code | Message |
|---|---|
| `card_declined` + `generic_decline` | "Your card was declined by the issuing bank. Please try a different card or contact your bank." |
| `card_declined` + `insufficient_funds` | "Your card has insufficient funds. Please try a different card." |
| `card_declined` + `lost_card` / `stolen_card` | "This card cannot be used. Please try a different card." (generic to avoid tipping off fraud) |
| `card_declined` + `do_not_honor` | "Your bank declined the payment. Please contact your card issuer or try a different card." |
| `card_declined` + `pickup_card` | "This card cannot be used. Please try a different card." |
| `card_not_supported` | "This type of card isn't supported. Please use a Visa, Mastercard, Amex, Discover, Diners, or JCB card." |
| `currency_not_supported` | "Your card doesn't support USD payments. Please try a different card." |
| `expired_card` | "Your card has expired. Please use a different card." |
| `processing_error` | "A processing error occurred. Please try again in a moment." |
| `authentication_required` | Trigger 3DS handler (see #4) — not a hard error. |
| `card_velocity_exceeded` | "Too many payment attempts. Please wait a few minutes and try again." |

### 4. 3D Secure (SCA) handling on server response

`unified-payment-authorization` already returns Stripe error info, but when a PI comes back as `requires_action` (3DS challenge), the client currently treats it as a failure. Fix:

- In `SimplePaymentAuthorizationForm.handleSubmit`, after the edge function call, if the response includes `requires_action: true` with a `client_secret`, call `stripe.confirmCardPayment(client_secret)` to launch the 3DS modal, then re-check status. The `payment-engine` already supports passing back `client_secret` on `requires_action`; I'll add the client branch.
- Same branch added in `PaymentAuthorizationForm` and `SecurePaymentForm`.

### 5. Trust indicators in checkout

- Add a small `PaymentTrustBar` under the form: lock icon + "Payments are encrypted and processed by Stripe. Your card details never touch our servers." Renders once at the bottom of the card field.

### 6. Mobile checkout polish

- `StripeCardElement` style: increase `fontSize` to `16px` (already set — good, prevents iOS zoom). Add `iconStyle: 'solid'` and ensure the wrapper has `min-h-[52px]` on mobile (already set). Add `inputMode` handled by Stripe automatically.

## Files I'll touch

- `src/components/StripeCardElement.tsx` — remove `hidePostalCode`, add `iconStyle: 'solid'`.
- `src/components/payment/AcceptedCardsRow.tsx` *(new)* — brand marks + trust line.
- `src/components/payment/PaymentTrustBar.tsx` *(new)* — encryption notice.
- `src/components/payment/SimplePaymentAuthorizationForm.tsx` — expand `getErrorMessage`, add 3DS branch, render `AcceptedCardsRow` + `PaymentTrustBar`.
- `src/components/payment/PaymentAuthorizationForm.tsx` — same error/3DS additions, render trust UI.
- `src/components/payment/SecurePaymentForm.tsx` — same.
- `src/components/worker/payment/InlineStripePaymentForm.tsx` — render `AcceptedCardsRow`.

## What I will NOT change

- `payment-engine` PaymentIntent creation logic — it's already correctly configured for manual capture with attached payment methods. Adding `automatic_payment_methods` would conflict with the existing `payment_method` + `confirm: true` flow.
- API version / Stripe SDK version — already on `2024-12-18.acacia`, current.
- Currency — USD is correct for a US merchant; Stripe auto-FXes foreign cards.
- Webhook handlers — unchanged.

## Out of scope (mention only)

Wallets (Apple Pay / Google Pay) would require switching to the `PaymentElement` and adding domain verification. Happy to do that in a follow-up if you want — it's a separate ~half-day change.
