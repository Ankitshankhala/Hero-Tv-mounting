
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info } from 'lucide-react';
import { usePaymentAuthorization } from '@/hooks/usePaymentAuthorization';
import { supabase } from '@/integrations/supabase/client';

const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_...');

interface PaymentAuthorizationFormProps {
  amount: number;
  bookingId: string;
  customerEmail?: string;
  customerName?: string;
  onAuthorizationSuccess: () => void;
  onAuthorizationFailure: (error: string) => void;
}

const PaymentAuthorizationFormContent = ({
  amount,
  bookingId,
  customerEmail,
  customerName,
  onAuthorizationSuccess,
  onAuthorizationFailure,
}: PaymentAuthorizationFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState('');
  const { createPaymentAuthorization, processing } = usePaymentAuthorization();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      onAuthorizationFailure('Stripe not loaded');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onAuthorizationFailure('Card element not found');
      return;
    }

    try {
      // Create payment authorization
      const result = await createPaymentAuthorization({
        bookingId,
        amount,
        customerEmail,
        customerName,
      });

      if (!result.success || !result.client_secret) {
        onAuthorizationFailure(result.error || 'Failed to create payment authorization');
        return;
      }

      // Confirm payment intent to authorize the card
      const confirmResult = await stripe.confirmCardPayment(result.client_secret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (confirmResult.error) {
        onAuthorizationFailure(confirmResult.error.message || 'Payment authorization failed');
        return;
      }

      if (confirmResult.paymentIntent?.status === 'requires_capture') {
        // Update booking status to authorized
        await supabase
          .from('bookings')
          .update({ 
            status: 'authorized',
            payment_status: 'authorized'
          })
          .eq('id', bookingId);

        onAuthorizationSuccess();
      } else {
        onAuthorizationFailure('Payment authorization was not successful');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment authorization failed';
      onAuthorizationFailure(errorMessage);
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

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="flex items-center space-x-2">
          <Lock className="h-3 w-3" />
          <span>Your payment information is encrypted and secure</span>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payment Authorization</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 border rounded-md">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                  },
                }}
                onChange={(event) => {
                  setCardError(event.error ? event.error.message : '');
                }}
              />
            </div>
            
            {cardError && (
              <Alert variant="destructive">
                <AlertDescription>{cardError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-md">
              <span className="font-semibold">Authorization Amount:</span>
              <span className="text-2xl font-bold text-blue-600">${amount.toFixed(2)}</span>
            </div>

            <Button 
              type="submit"
              disabled={!stripe || processing || !!cardError}
              className="w-full"
              size="lg"
            >
              {processing ? 'Authorizing...' : `Authorize $${amount.toFixed(2)}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export const PaymentAuthorizationForm = (props: PaymentAuthorizationFormProps) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentAuthorizationFormContent {...props} />
    </Elements>
  );
};
