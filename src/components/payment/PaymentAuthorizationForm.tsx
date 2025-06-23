
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info } from 'lucide-react';
import { usePaymentAuthorization } from '@/hooks/usePaymentAuthorization';
import { StripeCardElement } from '@/components/StripeCardElement';
import { supabase } from '@/integrations/supabase/client';

interface PaymentAuthorizationFormProps {
  amount: number;
  bookingId: string;
  customerEmail?: string;
  customerName?: string;
  onAuthorizationSuccess: () => void;
  onAuthorizationFailure: (error: string) => void;
}

export const PaymentAuthorizationForm = ({
  amount,
  bookingId,
  customerEmail,
  customerName,
  onAuthorizationSuccess,
  onAuthorizationFailure,
}: PaymentAuthorizationFormProps) => {
  const [cardError, setCardError] = useState('');
  const [stripeReady, setStripeReady] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const { createPaymentAuthorization, processing } = usePaymentAuthorization();

  const handleStripeReady = (stripeInstance: any, elementsInstance: any, cardElementInstance: any) => {
    console.log('Stripe ready for payment authorization');
    setStripe(stripeInstance);
    setElements(elementsInstance);
    setCardElement(cardElementInstance);
    setStripeReady(true);
  };

  const handleStripeError = (error: string) => {
    console.error('Stripe error:', error);
    setCardError(error);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !cardElement) {
      onAuthorizationFailure('Payment form not ready. Please wait or refresh the page.');
      return;
    }

    if (!stripeReady) {
      onAuthorizationFailure('Payment system is still loading. Please wait.');
      return;
    }

    try {
      console.log('Starting payment authorization process...');

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

      console.log('Payment intent created, confirming with card...');

      // Confirm payment intent to authorize the card
      const confirmResult = await stripe.confirmCardPayment(result.client_secret, {
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
        onAuthorizationFailure(confirmResult.error.message || 'Payment authorization failed');
        return;
      }

      if (confirmResult.paymentIntent?.status === 'requires_capture') {
        console.log('Payment authorized successfully, updating booking status...');
        
        // Update booking status to authorized
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ 
            status: 'authorized',
            payment_status: 'authorized'
          })
          .eq('id', bookingId);

        if (updateError) {
          console.error('Failed to update booking status:', updateError);
          // Still call success since payment was authorized
        }

        onAuthorizationSuccess();
      } else {
        onAuthorizationFailure('Payment authorization was not successful');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment authorization failed';
      console.error('Payment authorization error:', error);
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Card Information
              </label>
              <StripeCardElement
                onReady={handleStripeReady}
                onError={handleStripeError}
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
              disabled={!stripeReady || processing || !!cardError}
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
