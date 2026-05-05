## Root cause

When a customer enters bad card details (wrong number, expired date, wrong CVC, declined card, etc.), Stripe throws a `StripeCardError` inside `payment-engine.authorize`. The current chain loses the useful information at three points:

1. **`payment-engine/index.ts`** — wraps everything in one `try/catch` that returns `{ success: false, error: error.message }` with HTTP **400**. The Stripe-specific fields (`code`, `decline_code`, `type`, `param`) are dropped, and only the raw English message survives.

2. **`unified-payment-authorization/index.ts`** — re-throws on engine error and returns HTTP **400** as well.

3. **`SimplePaymentAuthorizationForm.tsx`** — calls `supabase.functions.invoke(...)`. The Supabase client treats any non-2xx as a `FunctionsHttpError`, sets `data = null`, and exposes only the generic `"Edge Function returned a non-2xx status code"` string. The body containing the real Stripe error is never read. The form's existing `getErrorMessage()` mapper (which already knows codes like `incorrect_cvc`, `expired_card`, `card_declined`) therefore only ever sees `'api_error'` with an empty code, and shows the generic fallback.

That is why every bad-card scenario ends up as `"unknown 2xx"` in the UI.

## Fix (minimal, no behavioral changes for happy path)

Three small, surgical changes — nothing else touched.

### 1. `supabase/functions/payment-engine/index.ts`
- Detect Stripe errors in the outer `catch` (check `error.type === 'StripeCardError'` or `error.raw?.type`).
- For Stripe **card errors**, return HTTP **200** with:
  ```json
  {
    "success": false,
    "error": "<stripe message>",
    "stripe_error": {
      "type": "StripeCardError",
      "code": "incorrect_cvc",
      "decline_code": "...",
      "param": "cvc"
    }
  }
  ```
  Returning 200 (with `success:false`) is the standard Stripe-pattern so the Supabase client gives us the body. All existing callers already check `data?.success` first, so this does not change any happy-path or capture/refund logic.
- All other (non-Stripe) errors keep the existing HTTP 400 behavior — unchanged.

### 2. `supabase/functions/unified-payment-authorization/index.ts`
- When the engine response has `success:false` and `stripe_error`, forward the **same JSON shape** with HTTP **200** instead of throwing. Existing callers already gate on `data?.success`.
- Non-Stripe failures continue to throw → HTTP 400 (unchanged).

### 3. `src/components/payment/SimplePaymentAuthorizationForm.tsx`
- After `supabase.functions.invoke(...)`, when `authData?.success === false`, pass `authData.stripe_error?.type`, `authData.stripe_error?.code`, and `authData.error` into the existing `getErrorMessage()` helper. That helper already maps every relevant code to a friendly message — we just feed it real values.
- Keep the existing fallback path for true network/timeout errors untouched.

### Result

| User input | Old message | New message |
|---|---|---|
| Wrong CVC | "Edge Function returned a non-2xx status code" | "The security code is incorrect. Please check your card details." |
| Expired card | same generic | "This card has expired. Please check the expiration date or use a different card." |
| Card declined | same generic | "Your card was declined. Please try a different card or contact your bank." |
| Insufficient funds | same generic | "This card has insufficient funds. Please use a different payment method." |
| Network/timeout | "Payment is taking longer..." | unchanged |

## Safety / non-regression

- No DB schema changes, no RLS changes, no Stripe API changes.
- Happy-path response shape is unchanged (`success:true, payment_intent_id, ...`).
- Other actions in `payment-engine` (capture, refund, modify-authorization, complete-and-capture) are not modified — only the error-shaping in the shared outer `catch`.
- All other edge functions calling `payment-engine` already check `data?.success` before using the result, so changing card-error responses from HTTP 400 → HTTP 200+`success:false` is backward compatible.
- Only one edge function needs redeploy: `payment-engine` and `unified-payment-authorization`.

## Files touched

1. `supabase/functions/payment-engine/index.ts` — outer catch only (~15 lines).
2. `supabase/functions/unified-payment-authorization/index.ts` — forward Stripe error shape (~10 lines).
3. `src/components/payment/SimplePaymentAuthorizationForm.tsx` — pass real codes into existing `getErrorMessage()` (~5 lines).
