import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info } from 'lucide-react';
import { StripeCardElement } from '@/components/StripeCardElement';
import { AcceptedCardsRow } from '@/components/payment/AcceptedCardsRow';
import { PaymentTrustBar } from '@/components/payment/PaymentTrustBar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * CartPaymentAuthorizationForm — payment-first variant.
 *
 * Unlike PaymentAuthorizationForm (which requires a pre-existing bookingId
 * and calls `unified-payment-authorization`), this form authorizes the card
 * against the full cart via `create-authorized-booking`. The booking row is
 * only created server-side AFTER Stripe authorization succeeds.
 *
 * V2-only. Not consumed anywhere unless the `payment_first_enabled` flag
 * flips ON in `app_settings`.
 */

const mapStripeError = (
  errorType: string | undefined,
  errorCode: string | undefined,
  declineCode: string | undefined,
  fallback: string,
): string => {
  if (errorType === 'card_error' || errorType === 'StripeCardError') {
    if (errorCode === 'card_declined') {
      switch (declineCode) {
        case 'insufficient_funds':
          return 'Your card has insufficient funds. Please try a different card.';
        case 'lost_card':
        case 'stolen_card':
        case 'pickup_card':
          return 'This card cannot be used. Please try a different card.';
        case 'do_not_honor':
          return 'Your bank declined the payment. Please contact your card issuer or try a different card.';
        default:
          return 'Your card was declined by the issuing bank. Please try a different card or contact your bank.';
      }
    }
    if (errorCode === 'insufficient_funds') return 'Your card has insufficient funds.';
    if (errorCode === 'expired_card') return 'Your card has expired.';
    if (errorCode === 'incorrect_cvc') return 'The security code is incorrect.';
    if (errorCode === 'incorrect_number' || errorCode === 'invalid_number')
      return 'Your card number is incorrect.';
  }
  return fallback;
};

export interface AuthorizeCartPayload {
  services: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    options?: Record<string, any>;
  }>;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  guest_customer_info: {
    email: string;
    name: string;
    phone: string;
    zipcode: string;
  };
  tip_amount: number;
  coupon_id?: string | null;
  coupon_code?: string | null;
  coupon_discount?: number;
  subtotal_before_discount?: number | null;
  customer_id?: string | null;
  location_notes?: string;
  preferred_worker_id?: string | null;
}

interface Props {
  amount: number;
  customerEmail: string;
  customerName: string;
  buildPayload: () => AuthorizeCartPayload;
  onSuccess: (result: { booking_id: string; payment_intent_id: string }) => void;
  onFailure: (error: string) => void;
  onNoWorkers?: () => void;
}

export const CartPaymentAuthorizationForm = ({
  amount,
  customerEmail,
  customerName,
  buildPayload,
  onSuccess,
  onFailure,
  onNoWorkers,
}: Props) => {
  const [cardError, setCardError] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [stripeInitialized, setStripeInitialized] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stripe, setStripe] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cardElement, setCardElement] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStripeReady = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stripeInstance: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _elementsInstance: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cardElementInstance: any,
  ) => {
    setStripe(stripeInstance);
    setCardElement(cardElementInstance);
    setStripeInitialized(true);
    setFormError('');
    setCardError('');
  };

  const handleStripeChange = ({
    errorMessage,
    complete,
  }: {
    errorMessage: string;
    complete: boolean;
  }) => {
    setCardError(errorMessage);
    setCardComplete(complete);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setCardError('');

    if (!stripe || !cardElement || !stripeInitialized) {
      const err = 'Payment form is still loading. Please wait a moment.';
      setFormError(err);
      onFailure(err);
      return;
    }
    if (!cardComplete) {
      const err = 'Please complete all card details before submitting.';
      setFormError(err);
      onFailure(err);
      return;
    }
    if (!customerEmail || !customerName) {
      const err = 'Customer information is required for payment.';
      setFormError(err);
      onFailure(err);
      return;
    }

    setLoading(true);
    try {
      // 1. Create Stripe PaymentMethod client-side.
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: { name: customerName, email: customerEmail },
      });
      if (pmError || !paymentMethod) {
        throw new Error(
          mapStripeError(
            pmError?.type,
            pmError?.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (pmError as any)?.decline_code,
            pmError?.message || 'Failed to create payment method',
          ),
        );
      }

      // 2. Authorize the card against the cart. NO booking row exists yet.
      const cart = buildPayload();
      const { data: authRes, error: invokeErr } = await supabase.functions.invoke(
        'create-authorized-booking',
        {
          body: {
            ...cart,
            payment_method_id: paymentMethod.id,
          },
        },
      );
      if (invokeErr) throw new Error(invokeErr.message || 'Authorization request failed');

      // 3a. Success — booking row already created server-side.
      if (authRes?.success && authRes?.booking_id) {
        toast({
          title: 'Payment Authorized ✓',
          description: `Successfully authorized $${amount.toFixed(2)}`,
        });
        onSuccess({
          booking_id: authRes.booking_id,
          payment_intent_id: authRes.payment_intent_id,
        });
        return;
      }

      // 3b. 3DS challenge — cart is staged in pending_authorizations.
      if (authRes && authRes.requires_action && authRes.client_secret) {
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          authRes.client_secret,
        );
        if (confirmError) {
          throw new Error(
            mapStripeError(
              confirmError.type,
              confirmError.code,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (confirmError as any).decline_code,
              confirmError.message || 'Card authentication failed',
            ),
          );
        }
        if (
          paymentIntent &&
          (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')
        ) {
          const { data: finalizeRes, error: finalizeErr } = await supabase.functions.invoke(
            'create-authorized-booking',
            { body: { mode: 'finalize', payment_intent_id: paymentIntent.id } },
          );
          if (finalizeErr || !finalizeRes?.success || !finalizeRes?.booking_id) {
            throw new Error(
              finalizeRes?.error || finalizeErr?.message || 'Failed to finalize payment',
            );
          }
          toast({
            title: 'Payment Authorized ✓',
            description: `Successfully authorized $${amount.toFixed(2)}`,
          });
          onSuccess({
            booking_id: finalizeRes.booking_id,
            payment_intent_id: paymentIntent.id,
          });
          return;
        }
        throw new Error(
          `Authentication did not complete (status: ${paymentIntent?.status || 'unknown'}).`,
        );
      }

      // 3c. No workers available — bail cleanly, nothing was charged/persisted.
      if (authRes?.error === 'no_workers_available') {
        const msg =
          "We don't have any technicians available for that date/area. Please pick another time or ZIP.";
        setFormError(msg);
        onNoWorkers?.();
        onFailure(msg);
        return;
      }

      // 3d. Structured card/decline error passthrough.
      if (authRes && authRes.success === false) {
        const stripeErr = authRes.stripe_error;
        const friendly = stripeErr
          ? mapStripeError(
              stripeErr.type === 'StripeCardError' ? 'card_error' : stripeErr.type,
              stripeErr.code,
              stripeErr.decline_code,
              authRes.error || 'Card error',
            )
          : authRes.error || 'Authorization failed';
        throw new Error(friendly);
      }

      throw new Error('Unexpected response from authorization service.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment authorization failed';
      setFormError(message);
      toast({
        title: 'Payment Authorization Failed',
        description: message,
        variant: 'destructive',
      });
      onFailure(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Shield className="h-6 w-6 text-green-600" />
          <Lock className="h-4 w-4 text-gray-500" />
        </div>
        <CardTitle className="text-xl font-semibold">Secure Payment Authorization</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Authorization Only</p>
              <p>
                We'll authorize ${amount.toFixed(2)} on your card but won't charge you until the
                service is completed.
              </p>
            </div>
          </div>
        </div>

        {(formError || cardError) && (
          <Alert variant="destructive">
            <AlertDescription>{formError || cardError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <AcceptedCardsRow />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CreditCard className="inline h-4 w-4 mr-1" />
              Payment Information
            </label>
            <StripeCardElement
              onReady={handleStripeReady}
              onError={(e) => {
                if (e && e.trim()) setFormError(e);
              }}
              onChange={handleStripeChange}
            />
          </div>
          <PaymentTrustBar />

          <div className="space-y-2 text-sm text-gray-600">
            <p>• Your card will be authorized for ${amount.toFixed(2)}</p>
            <p>• Payment will only be captured after service completion</p>
            <p>• You can cancel anytime before the worker arrives</p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!stripeInitialized || !cardComplete || loading}
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Authorizing Payment...</span>
              </div>
            ) : (
              `Authorize $${amount.toFixed(2)}`
            )}
          </Button>
        </form>

        <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
          <Lock className="h-3 w-3" />
          <span>Secured by Stripe • PCI Compliant</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CartPaymentAuthorizationForm;
