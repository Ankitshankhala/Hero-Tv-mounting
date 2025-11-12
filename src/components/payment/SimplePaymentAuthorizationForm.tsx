import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { StripeCardElement, StripeCardElementRef } from '@/components/StripeCardElement';
import { supabase } from '@/integrations/supabase/client';

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

  const getErrorMessage = (errorType: string, errorCode: string, errorMessage: string): string => {
    // Map Stripe error codes to user-friendly messages
    if (errorType === 'card_error') {
      if (errorCode === 'card_declined') {
        return 'Your card was declined. Please try a different card or contact your bank.';
      }
      if (errorCode === 'insufficient_funds') {
        return 'This card has insufficient funds. Please use a different payment method.';
      }
      if (errorCode === 'expired_card') {
        return 'This card has expired. Please check the expiration date or use a different card.';
      }
      if (errorCode === 'incorrect_cvc') {
        return 'The security code is incorrect. Please check your card details.';
      }
      if (errorCode === 'authentication_required' || errorCode === 'payment_intent_authentication_failure') {
        return 'Card authentication failed. Please verify your card details and try again.';
      }
    }
    
    if (errorType === 'validation_error') {
      if (errorCode === 'invalid_expiry_year_past') {
        return 'Your card\'s expiration year is in the past. Please check your card details.';
      }
      if (errorCode === 'invalid_expiry_month_past') {
        return 'Your card\'s expiration month is in the past. Please check your card details.';
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
      console.log(`🎯 Creating payment intent for booking (attempt #${attemptNumber}):`, bookingId);
      
      // Generate unique idempotency key for each attempt
      const uniqueIdempotencyKey = `${crypto.randomUUID()}-attempt-${attemptNumber}`;
      console.log('Generated idempotency key:', uniqueIdempotencyKey);
      
      const { data: intentData, error: intentError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: {
            amount, // Pass amount in dollars, edge function will convert to cents
            currency: 'usd',
            idempotency_key: uniqueIdempotencyKey,
            user_id: user?.id || null,
            booking_id: bookingId,
            customer_email: customerEmail,
            customer_name: customerName,
            testing_mode: process.env.NODE_ENV === 'development',
          },
        }
      );

      if (intentError || !intentData?.client_secret) {
        throw new Error(intentError?.message || 'Failed to create payment intent');
      }

      console.log('Payment intent created, confirming with card...');

      // Confirm payment intent to authorize the card with 3D Secure support
      console.log('Confirming card payment with 3D Secure support...');
      
      const confirmResult = await stripe.confirmCardPayment(intentData.client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: customerName,
            email: customerEmail,
          },
        },
      });

      if (confirmResult.error) {
        console.error('Payment confirmation error:', confirmResult.error);
        
        const stripeError = confirmResult.error;
        const errorMessage = getErrorMessage(
          stripeError.type || 'unknown',
          stripeError.code || '',
          stripeError.message || 'Payment authorization failed'
        );
        
        setFormError(errorMessage);
        
        // For card errors and validation errors, automatically prepare for retry
        if (stripeError.type === 'card_error' || stripeError.type === 'validation_error') {
          console.log('Card validation error detected, card element can be reset for retry');
        }
        
        onAuthorizationFailure(errorMessage);
        return;
      }

      // Check payment intent status - handle all valid authorization states
      const paymentIntent = confirmResult.paymentIntent;
      console.log('Payment intent status after confirmation:', paymentIntent?.status);

      if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
        console.log('✅ Payment authorized successfully!');
        
        // Update transaction and booking status after successful authorization
        try {
          console.log('Updating transaction status for payment intent:', intentData.payment_intent_id);
          
          const { data: updateData, error: updateError } = await supabase.functions.invoke(
            'update-transaction-status',
            {
              body: {
                payment_intent_id: intentData.payment_intent_id,
                status: 'requires_capture' // This will map to 'authorized' in the function
              }
            }
          );
          
          if (updateError) {
            console.error('Transaction status update failed:', updateError);
          } else {
            console.log('Transaction and booking status updated successfully:', updateData);
          }
          
          console.log('Payment authorization flow completed successfully');
          onAuthorizationSuccess(intentData.payment_intent_id);
        } catch (error) {
          console.error('Error updating transaction status:', error);
          
          // Since payment is authorized in Stripe, we should still succeed
          console.warn('Transaction update error, but payment authorized. Proceeding with success.');
          onAuthorizationSuccess(intentData.payment_intent_id);
        }
      } else {
        const error = `Payment authorization incomplete. Status: ${paymentIntent?.status || 'unknown'}`;
        console.error('Payment not authorized:', paymentIntent?.status);
        setFormError(error);
        onAuthorizationFailure(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment authorization failed';
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
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Card Information
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Enter your card number, expiry date (MM/YY), and security code (CVC)
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
