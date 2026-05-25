import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { StripeCardElement, StripeCardElementRef } from '@/components/StripeCardElement';
import { AcceptedCardsRow } from '@/components/payment/AcceptedCardsRow';
import { PaymentTrustBar } from '@/components/payment/PaymentTrustBar';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, PAYMENT_INTENT_TIMEOUT, CARD_CONFIRMATION_TIMEOUT } from '@/utils/paymentTimeout';

interface SimplePaymentAuthorizationFormProps {
  amount: number;
  bookingId: string;
  customerEmail: string;
  customerName: string;
  onAuthorizationSuccess: (paymentIntentId: string) => void;
  onAuthorizationFailure: (error: string) => void;
}

export const SimplePaymentAuthorizationForm = ({
  amount,
  bookingId,
  customerEmail,
  customerName,
  onAuthorizationSuccess,
  onAuthorizationFailure,
}: SimplePaymentAuthorizationFormProps) => {
  const [cardError, setCardError] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [stripeInitialized, setStripeInitialized] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const cardElementRef = useRef<StripeCardElementRef>(null);
  
  const { user } = useAuth();

  const handleStripeReady = (stripeInstance: any, elementsInstance: any, cardElementInstance: any) => {
    console.log('Stripe ready for payment authorization');
    setStripe(stripeInstance);
    setElements(elementsInstance);
    setCardElement(cardElementInstance);
    setStripeInitialized(true);
    setFormError('');
    setCardError('');
  };

  const handleStripeChange = ({ errorMessage, complete }: { errorMessage: string; complete: boolean }) => {
    setCardError(errorMessage);
    setCardComplete(complete);
    
    if (errorMessage) {
      console.log('Card validation error:', errorMessage);
    } else if (complete) {
      console.log('✅ Card details complete and valid');
    }
  };

  const handleStripeError = (error: string) => {
    if (error && error.trim()) {
      console.error('Stripe system error:', error);
      // Only set formError for critical system errors, not card validation
      if (error.includes('Payment form container') || error.includes('Payment system') || error.includes('configuration')) {
        setFormError(error);
        setStripeInitialized(false);
      }
    } else {
      if (formError && !formError.includes('Payment form not ready') && !formError.includes('Payment system') && !formError.includes('configuration')) {
        setFormError('');
      }
    }
  };

  const handleRetry = async () => {
    console.log('Retrying payment...');
    setFormError('');
    setCardError('');
    setRetryCount(prev => prev + 1);
    
    // Reset the card element for fresh input
    if (cardElementRef.current) {
      await cardElementRef.current.reset();
    }
  };

  const getErrorMessage = (errorType: string, errorCode: string, errorMessage: string, declineCode?: string): string => {
    // Map Stripe error codes (and Stripe `decline_code`) to user-friendly messages.
    // See https://stripe.com/docs/declines/codes
    if (errorType === 'card_error') {
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
          case 'generic_decline':
          default:
            return 'Your card was declined by the issuing bank. Please try a different card or contact your bank.';
        }
      }
      if (errorCode === 'insufficient_funds') {
        return 'Your card has insufficient funds. Please try a different card.';
      }
      if (errorCode === 'expired_card') {
        return 'Your card has expired. Please use a different card.';
      }
      if (errorCode === 'incorrect_cvc') {
        return 'The security code is incorrect. Please check your card details.';
      }
      if (errorCode === 'incorrect_number' || errorCode === 'invalid_number') {
        return 'Your card number is incorrect. Please double-check and try again.';
      }
      if (errorCode === 'card_not_supported') {
        return "This type of card isn't supported. Please use a Visa, Mastercard, Amex, Discover, Diners, or JCB card.";
      }
      if (errorCode === 'currency_not_supported') {
        return "Your card doesn't support USD payments. Please try a different card.";
      }
      if (errorCode === 'processing_error') {
        return 'A processing error occurred. Please try again in a moment.';
      }
      if (errorCode === 'card_velocity_exceeded') {
        return 'Too many payment attempts. Please wait a few minutes and try again.';
      }
      if (errorCode === 'authentication_required' || errorCode === 'payment_intent_authentication_failure') {
        return 'Your bank requires extra authentication for this card. Please complete the verification prompt and try again.';
      }
    }

    if (errorType === 'validation_error') {
      if (errorCode === 'invalid_expiry_year_past') {
        return "Your card's expiration year is in the past. Please check your card details.";
      }
      if (errorCode === 'invalid_expiry_month_past') {
        return "Your card's expiration month is in the past. Please check your card details.";
      }
      if (errorCode === 'incomplete_expiry') {
        return 'Please enter a valid expiry date (MM/YY format).';
      }
      if (errorCode === 'incomplete_number') {
        return 'Please enter a complete card number.';
      }
      if (errorCode === 'incomplete_cvc') {
        return 'Please enter a valid security code (CVC).';
      }
      return 'Please check your card details and try again.';
    }

    if (errorType === 'api_error') {
      return 'Payment service temporarily unavailable. Please try again.';
    }

    return errorMessage || 'Payment authorization failed. Please try again.';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    console.log('💳 Payment authorization started:', {
      hasStripe: !!stripe,
      hasElements: !!elements,
      hasCardElement: !!cardElement,
      amount,
      customerEmail,
      bookingId,
      attemptNumber: retryCount + 1
    });

    setCardError('');
    setFormError('');

    if (!stripe || !elements || !cardElement) {
      const error = 'Payment form not ready. Please wait or refresh the page.';
      console.error('❌ Payment form not ready:', { stripe: !!stripe, elements: !!elements, cardElement: !!cardElement });
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    if (!stripeInitialized) {
      const error = 'Payment system is still loading. Please wait.';
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    if (!cardComplete) {
      const error = 'Please complete all card details before submitting.';
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    try {
      setLoading(true);
      const attemptNumber = retryCount + 1;
      console.log(`🎯 Authorizing payment for booking (attempt #${attemptNumber}):`, bookingId);
      
      // Create payment method from card element
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: customerName,
          email: customerEmail,
        },
      });

      if (pmError || !paymentMethod) {
        const errorMessage = getErrorMessage(
          pmError?.type || 'unknown',
          pmError?.code || '',
          pmError?.message || 'Failed to create payment method',
          (pmError as any)?.decline_code
        );
        setFormError(errorMessage);
        onAuthorizationFailure(errorMessage);
        return;
      }

      console.log(`⚡ Using unified payment authorization endpoint`);
      
      // Use unified payment authorization endpoint (single API call)
      const { data: authData, error: authError } = await withTimeout(
        supabase.functions.invoke(
          'unified-payment-authorization',
          {
            body: {
              bookingId,
              customerEmail,
              customerName,
              paymentMethodId: paymentMethod.id,
              tip: 0,
            },
          }
        ),
        PAYMENT_INTENT_TIMEOUT * 2, // Give more time for unified endpoint
        'unified-payment-authorization'
      );

      // ===== 3D Secure / SCA branch =====
      // The engine returns success:false + requires_action:true + client_secret
      // when the card issuer requires a 3DS challenge. We launch the modal
      // client-side, then ask the engine to finalize the authorization.
      if (authData && authData.success === false && authData.requires_action && authData.client_secret) {
        console.log('🔐 3D Secure challenge required, launching Stripe modal');
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(authData.client_secret);

        if (confirmError) {
          const errorMessage = getErrorMessage(
            confirmError.type === 'card_error' ? 'card_error' : 'api_error',
            confirmError.code || '',
            confirmError.message || 'Card authentication failed',
            (confirmError as any).decline_code
          );
          setFormError(errorMessage);
          onAuthorizationFailure(errorMessage);
          return;
        }

        if (paymentIntent && (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
          // Tell the engine to finalize the booking row now that 3DS passed.
          const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke(
            'unified-payment-authorization',
            {
              body: {
                bookingId,
                customerEmail,
                customerName,
                paymentIntentId: paymentIntent.id,
                action: 'finalize_3ds',
              },
            }
          );

          if (finalizeError || !finalizeData?.success) {
            const errorMessage = finalizeData?.error || finalizeError?.message || 'Failed to finalize payment';
            setFormError(errorMessage);
            onAuthorizationFailure(errorMessage);
            return;
          }

          console.log('✅ Payment authorized after 3DS!', paymentIntent.id);
          onAuthorizationSuccess(paymentIntent.id);
          return;
        }

        const errorMessage = `Authentication did not complete (status: ${paymentIntent?.status || 'unknown'}). Please try again.`;
        setFormError(errorMessage);
        onAuthorizationFailure(errorMessage);
        return;
      }

      if (authError || !authData?.success) {
        const errorDetails = authData?.error || authError?.message || 'Failed to authorize payment';
        console.error('Payment authorization error:', errorDetails, authData?.stripe_error);

        // If the engine returned structured Stripe card-error details,
        // map them to a friendly message via the existing helper.
        const stripeErr = authData?.stripe_error;
        const errorMessage = stripeErr
          ? getErrorMessage(
              stripeErr.type === 'StripeCardError' ? 'card_error' : 'api_error',
              stripeErr.code || '',
              authData?.error || 'Card error',
              stripeErr.decline_code
            )
          : getErrorMessage('api_error', '', errorDetails);

        setFormError(errorMessage);
        onAuthorizationFailure(errorMessage);
        return;
      }

      console.log('✅ Payment authorized successfully!', authData.payment_intent_id);
      console.log(`⚡ Performance: ${authData.performance?.total_ms}ms total (target: <1500ms)`);
      
      console.log('Payment authorization flow completed successfully');
      onAuthorizationSuccess(authData.payment_intent_id);
    } catch (error: any) {
      const errorMessage = error.name === 'PaymentTimeoutError'
        ? 'Payment is taking longer than expected. Please check your connection and try again.'
        : error instanceof Error ? error.message : 'Payment authorization failed';
      console.error('Payment authorization error:', error);
      setFormError(errorMessage);
      onAuthorizationFailure(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Your booking will be confirmed with a ${amount.toFixed(2)} payment authorization. The charge will only occur when your service is completed.
        </AlertDescription>
      </Alert>

      {process.env.NODE_ENV === 'development' && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Test Mode:</strong> Use card number <code className="bg-blue-100 px-1 rounded">4242424242424242</code> 
            with any future expiry date and CVC for testing.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Lock className="h-3 w-3" />
              <span className="font-medium">Secure Payment Process</span>
            </div>
            <ul className="text-sm space-y-1 ml-5">
              <li>• Authorization confirms your booking instantly</li>
              <li>• No charge until service is completed</li>
              <li>• Encrypted processing with Stripe</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {formError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">Payment Error</div>
              <div>{formError}</div>
              {retryCount < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
              {retryCount >= 3 && (
                <p className="text-sm mt-2">
                  Having trouble? Please contact support or try a different payment method.
                </p>
              )}
              {formError.includes('expiration') && (
                <div className="mt-2 text-sm">
                  Please enter your card's expiry date in MM/YY format (e.g., 12/25 for December 2025).
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payment Authorization</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AcceptedCardsRow />
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Card Information
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Enter your card number, expiry date (MM/YY), security code (CVC), and postal code.
              </p>
              <StripeCardElement
                ref={cardElementRef}
                onReady={handleStripeReady}
                onError={handleStripeError}
                onChange={handleStripeChange}
              />
              {!cardError && cardComplete && (
                <div className="flex items-center space-x-1 text-green-600 text-xs">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Card details valid</span>
                </div>
              )}
            </div>
            <PaymentTrustBar />

            <Button
              type="submit"
              disabled={loading || !stripeInitialized || !cardComplete}
              className="w-full"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Authorizing Payment...</span>
                </div>
              ) : (
                `Authorize Payment - $${amount.toFixed(2)}`
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
