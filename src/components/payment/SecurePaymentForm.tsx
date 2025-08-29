import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info } from 'lucide-react';
import { StripeCardElement } from '@/components/StripeCardElement';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { usePaymentProcessing } from '@/hooks/usePaymentProcessing';
import { usePaymentMethodCollection } from '@/hooks/usePaymentMethodCollection';

interface SecurePaymentFormProps {
  amount: number;
  bookingId?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  onPaymentSuccess: () => void;
  onPaymentFailure: (error: string) => void;
  collectOnly?: boolean; // New prop to indicate we're only collecting, not charging
}

export const SecurePaymentForm = ({
  amount,
  bookingId,
  customerId,
  customerEmail,
  customerName,
  onPaymentSuccess,
  onPaymentFailure,
  collectOnly = false
}: SecurePaymentFormProps) => {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'digital_wallet' | 'cash'>('card');
  const [stripeElements, setStripeElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [stripe, setStripe] = useState<any>(null);
  const [cardError, setCardError] = useState('');
  
  const { processOnlinePayment, processing, retryPayment } = usePaymentProcessing();
  const { savePaymentMethod } = usePaymentMethodCollection();

  const handleStripeReady = (stripeInstance: any, elements: any, cardEl: any) => {
    setStripe(stripeInstance);
    setStripeElements(elements);
    setCardElement(cardEl);
  };

  const handlePayment = async () => {
    if (!bookingId || !customerId) {
      onPaymentFailure('Missing booking or customer information');
      return;
    }

    if (paymentMethod === 'cash') {
      // Handle cash payment (no online processing needed)
      onPaymentSuccess();
      return;
    }

    if (paymentMethod === 'card' && (!stripe || !cardElement)) {
      onPaymentFailure('Payment form not ready. Please try again.');
      return;
    }

    if (collectOnly && paymentMethod === 'card') {
      // Only collect payment method without charging
      if (!customerEmail || !customerName) {
        onPaymentFailure('Customer information is required');
        return;
      }

      try {
        const result = await savePaymentMethod(
          {
            bookingId,
            customerEmail,
            customerName
          },
          stripe,
          cardElement
        );

        if (result.success) {
          onPaymentSuccess();
        } else {
          onPaymentFailure(result.error || 'Failed to save payment method');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Payment setup failed';
        onPaymentFailure(errorMessage);
      }
    } else {
      // Handle immediate payment (existing logic)
      try {
        let paymentMethodId = '';
  
        if (paymentMethod === 'card') {
          // Validate required data for card payments
          if (!stripe || !cardElement) {
            onPaymentFailure('Payment form not ready. Please try again.');
            return;
          }

          // Create payment method with Stripe
          const { error, paymentMethod: stripePaymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
          });
  
          if (error) {
            onPaymentFailure(error.message);
            return;
          }
  
          paymentMethodId = stripePaymentMethod.id;
        }

        // Validate we have payment method ID for card payments
        if (paymentMethod === 'card' && !paymentMethodId) {
          onPaymentFailure('No payment method selected. Please select a payment method.');
          return;
        }
  
        // Process the payment with required customer information
        const paymentFunction = () => processOnlinePayment({
          bookingId,
          customerId,
          amount,
          paymentMethodId,
          customerEmail, // Pass customer email
          customerName,  // Pass customer name
          description: `Booking payment - $${amount.toFixed(2)}`
        });
  
        const result = await retryPayment(paymentFunction);
  
        if (result.success) {
          onPaymentSuccess();
        } else {
          onPaymentFailure(result.error || 'Payment failed');
        }
  
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
        onPaymentFailure(errorMessage);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Badge */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="flex items-center space-x-2">
          <Lock className="h-3 w-3" />
          <span>Your payment information is encrypted and secure</span>
        </AlertDescription>
      </Alert>

      {collectOnly && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your credit card will be securely saved and charged manually by the technician after service completion. No charge will be made at this time.
          </AlertDescription>
        </Alert>
      )}

      <PaymentMethodSelector 
        selectedMethod={paymentMethod}
        onMethodChange={setPaymentMethod}
        allowCash={true}
      />

      {paymentMethod === 'card' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Card Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StripeCardElement 
              onReady={handleStripeReady}
              onError={setCardError}
            />
            {cardError && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{cardError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {paymentMethod === 'digital_wallet' && (
        <Alert>
          <AlertDescription>
            Digital wallet payments will be processed securely through your device's payment system.
          </AlertDescription>
        </Alert>
      )}

      {paymentMethod === 'cash' && (
        <Alert>
          <AlertDescription>
            Payment will be collected by the technician at the time of service.
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold">
              {collectOnly ? 'Estimated Amount:' : 'Total Amount:'}
            </span>
            <span className="text-2xl font-bold text-green-600">${amount.toFixed(2)}</span>
          </div>
          {collectOnly && (
            <p className="text-sm text-gray-600 mt-1">
              Final amount may vary based on services provided
            </p>
          )}
        </CardContent>
      </Card>

      <Button 
        onClick={handlePayment}
        disabled={processing || (paymentMethod === 'card' && (!stripe || !!cardError))}
        className="w-full"
        size="lg"
      >
        {processing ? 'Processing...' : 
         paymentMethod === 'cash' ? 'Confirm Booking' : 
         collectOnly ? 'Save Payment Method & Confirm Booking' :
         `Pay $${amount.toFixed(2)}`}
      </Button>
    </div>
  );
};
