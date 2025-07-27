import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { StripeCardElement } from '@/components/StripeCardElement';
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
  const [stripeReady, setStripeReady] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();

  const handleStripeReady = (stripeInstance: any, elementsInstance: any, cardElementInstance: any) => {
    console.log('Stripe ready for payment authorization');
    setStripe(stripeInstance);
    setElements(elementsInstance);
    setCardElement(cardElementInstance);
    setStripeReady(true);
    setFormError('');
    setCardError('');
  };

  const handleStripeError = (error: string) => {
    if (error && error.trim()) {
      console.error('Stripe error:', error);
      setCardError(error);
      setFormError(error);
      setStripeReady(false);
    } else {
      console.log('✅ Stripe error cleared, card validation successful');
      setCardError('');
      if (formError && !formError.includes('Payment form not ready') && !formError.includes('Payment system')) {
        setFormError('');
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    console.log('💳 Payment authorization started:', {
      hasStripe: !!stripe,
      hasElements: !!elements,
      hasCardElement: !!cardElement,
      amount,
      customerEmail,
      bookingId
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

    if (!stripeReady) {
      const error = 'Payment system is still loading. Please wait.';
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    try {
      setLoading(true);
      console.log('🎯 Creating payment intent for existing booking:', bookingId);
      
      // Generate idempotency key for this payment attempt
      const idempotencyKey = crypto.randomUUID();
      console.log('Generated idempotency key:', idempotencyKey);
      
      const { data: intentData, error: intentError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: {
            amount,
            currency: 'usd',
            idempotency_key: idempotencyKey,
            user_id: user?.id,
            booking_id: bookingId,
            customer_email: customerEmail,
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
        
        // Handle Stripe errors with specific 3D Secure messaging
        let errorMessage = 'Payment authorization failed';
        const stripeError = confirmResult.error;
        
        switch (stripeError.type) {
          case 'card_error':
            if (stripeError.code === 'card_declined') {
              errorMessage = 'Your card was declined. Please try a different payment method.';
            } else if (stripeError.code === 'authentication_required') {
              errorMessage = 'Authentication failed. Please try again or use a different card.';
            } else if (stripeError.code === 'payment_intent_authentication_failure') {
              errorMessage = 'Card authentication failed. Please verify your card details and try again.';
            } else if (stripeError.code === 'insufficient_funds') {
              errorMessage = 'Insufficient funds. Please try a different card.';
            } else if (stripeError.code === 'expired_card') {
              errorMessage = 'Your card has expired. Please use a different card.';
            } else if (stripeError.code === 'incorrect_cvc') {
              errorMessage = 'The security code is incorrect. Please check your card details.';
            } else {
              errorMessage = stripeError.message || 'There was an issue with your card. Please try again.';
            }
            break;
          case 'validation_error':
            errorMessage = 'Please check your card details and try again.';
            break;
          case 'api_error':
            errorMessage = 'Payment service temporarily unavailable. Please try again.';
            break;
          default:
            errorMessage = stripeError.message || 'Payment authorization failed. Please try again.';
        }
        
        setFormError(errorMessage);
        onAuthorizationFailure(errorMessage);
        return;
      }

      // Check payment intent status - handle all valid authorization states
      const paymentIntent = confirmResult.paymentIntent;
      console.log('Payment intent status after confirmation:', paymentIntent?.status);

      if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
        console.log('✅ Payment authorized successfully!');
        
        // Update transaction status to 'authorized' after successful payment
        try {
          const { TransactionManager } = await import('@/utils/transactionManager');
          const transactionManager = new TransactionManager();
          const updateResult = await transactionManager.updateTransactionByPaymentIntent(
            intentData.payment_intent_id,
            { status: 'authorized' }
          );
          
          if (!updateResult.success) {
            console.error('Failed to update transaction status:', updateResult.error);
            throw new Error(updateResult.error || 'Failed to update transaction status');
          }
          
          console.log('Transaction status updated to authorized');
          onAuthorizationSuccess(intentData.payment_intent_id);
        } catch (error) {
          console.error('Error updating transaction status:', error);
          const errorMessage = 'Payment authorized but failed to update transaction status';
          setFormError(errorMessage);
          onAuthorizationFailure(errorMessage);
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
          Your card will be authorized for ${amount.toFixed(2)} but not charged until after service completion.
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
        <AlertDescription className="flex items-center space-x-2">
          <Lock className="h-3 w-3" />
          <span>Your payment information is encrypted and secure</span>
        </AlertDescription>
      </Alert>

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
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
              <label className="text-sm font-medium text-gray-700">
                Card Information
              </label>
              <StripeCardElement
                onReady={handleStripeReady}
                onError={handleStripeError}
              />
              {!cardError && stripeReady && (
                <div className="flex items-center space-x-1 text-green-600 text-xs">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Card details valid</span>
                </div>
              )}
              {cardError && (
                <div className="text-red-600 text-xs">{cardError}</div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !stripeReady || !!cardError}
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