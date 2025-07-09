
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info } from 'lucide-react';
import { usePaymentAuthorization } from '@/hooks/usePaymentAuthorization';
import { StripeCardElement } from '@/components/StripeCardElement';
import { useBookingOperations } from '@/hooks/booking/useBookingOperations';

interface PaymentAuthorizationFormProps {
  amount: number;
  bookingId?: string;
  customerEmail?: string;
  customerName?: string;
  services?: any[];
  formData?: any;
  onAuthorizationSuccess: (createdBookingId?: string) => void;
  onAuthorizationFailure: (error: string) => void;
  requireAuth?: boolean; // New prop to control authentication requirement
}

export const PaymentAuthorizationForm = ({
  amount,
  bookingId,
  customerEmail,
  customerName,
  services,
  formData,
  onAuthorizationSuccess,
  onAuthorizationFailure,
  requireAuth = false, // Default to false for guest checkout
}: PaymentAuthorizationFormProps) => {
  const [cardError, setCardError] = useState('');
  const [stripeReady, setStripeReady] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [creatingBooking, setCreatingBooking] = useState(false);
  const { createPaymentAuthorization, processing } = usePaymentAuthorization();
  const { handleBookingSubmit } = useBookingOperations();

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
    console.error('Stripe error:', error);
    setCardError(error);
    setFormError(error);
    setStripeReady(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setCardError('');
    setFormError('');

    if (!stripe || !elements || !cardElement) {
      const error = 'Payment form not ready. Please wait or refresh the page.';
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

    // For guest checkout, ensure we have customer details
    if (!requireAuth && (!customerEmail || !customerName)) {
      const error = 'Customer information is required for payment.';
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    try {
      console.log('Starting payment authorization process...');

      // Create payment authorization (works for both authenticated and guest users)
      const result = await createPaymentAuthorization({
        bookingId: bookingId || 'temp-booking-ref',
        amount,
        customerEmail,
        customerName,
        requireAuth,
      });

      if (!result.success || !result.client_secret) {
        const error = result.error || 'Failed to create payment authorization';
        setFormError(error);
        onAuthorizationFailure(error);
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
        
        // Improved Stripe error handling
        let errorMessage = 'Payment authorization failed';
        const stripeError = confirmResult.error;
        
        switch (stripeError.type) {
          case 'card_error':
            if (stripeError.code === 'card_declined') {
              errorMessage = 'Your card was declined. Please try a different payment method.';
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

      if (confirmResult.paymentIntent?.status === 'requires_capture') {
        console.log('Payment authorized successfully, now creating booking...');
        
        // If we have booking data, create the booking now
        if (services && formData && !bookingId) {
          setCreatingBooking(true);
          try {
            const createdBookingId = await handleBookingSubmit(services, formData);
            console.log('Booking created after payment authorization:', createdBookingId);
            onAuthorizationSuccess(createdBookingId);
          } catch (bookingError) {
            console.error('Failed to create booking after payment authorization:', bookingError);
            setFormError('Payment authorized but booking creation failed. Please contact support.');
            onAuthorizationFailure('Payment authorized but booking creation failed. Please contact support.');
          } finally {
            setCreatingBooking(false);
          }
        } else {
          // If we already have a booking or no booking data, just proceed
          onAuthorizationSuccess(bookingId);
        }
      } else {
        const error = 'Payment authorization was not successful';
        setFormError(error);
        onAuthorizationFailure(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment authorization failed';
      console.error('Payment authorization error:', error);
      setFormError(errorMessage);
      onAuthorizationFailure(errorMessage);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {requireAuth 
            ? `Your card will be authorized for $${amount.toFixed(2)} but not charged until after service completion.`
            : `Your card will be authorized for $${amount.toFixed(2)} but not charged until after service completion. No account required.`
          }
        </AlertDescription>
      </Alert>

      {/* Development Test Card Helper */}
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
            </div>
            
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-md">
              <span className="font-semibold">Authorization Amount:</span>
              <span className="text-2xl font-bold text-blue-600">${amount.toFixed(2)}</span>
            </div>

            <Button 
              type="submit"
              disabled={!stripeReady || processing || creatingBooking || !!formError}
              className="w-full"
              size="lg"
            >
              {processing 
                ? 'Authorizing...' 
                : creatingBooking 
                  ? 'Creating Booking...' 
                  : `Authorize $${amount.toFixed(2)}`
              }
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
