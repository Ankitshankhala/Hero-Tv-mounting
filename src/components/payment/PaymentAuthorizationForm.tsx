import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info, AlertTriangle } from 'lucide-react';
import { useBookingPaymentFlow } from '@/hooks/useBookingPaymentFlow';
import { useAuth } from '@/hooks/useAuth';
import { StripeCardElement } from '@/components/StripeCardElement';
import { PaymentRecoveryAlert } from './PaymentRecoveryAlert';
import { supabase } from '@/integrations/supabase/client';

interface PaymentAuthorizationFormProps {
  amount: number;
  bookingId?: string;
  customerEmail?: string;
  customerName?: string;
  services?: any[];
  formData?: any;
  onAuthorizationSuccess: (createdBookingId?: string) => void;
  onAuthorizationFailure: (error: string) => void;
  requireAuth?: boolean;
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
  requireAuth = false,
}: PaymentAuthorizationFormProps) => {
  const [cardError, setCardError] = useState('');
  const [stripeReady, setStripeReady] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [paymentRecoveryInfo, setPaymentRecoveryInfo] = useState<{
    paymentIntentId: string;
    amount: number;
    customerEmail?: string;
    guestBookingData?: any;
    payment_intent_id?: string;
  } | null>(null);
  
  const { createBookingWithPayment, loading } = useBookingPaymentFlow();
  const { user, loading: authLoading } = useAuth();

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

    if (!requireAuth && (!customerEmail || !customerName)) {
      const error = 'Customer information is required for payment.';
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    try {
      console.log('Starting payment authorization process...');

      // Handle booking creation - different flow for authenticated vs guest users
      if (services && formData && !bookingId) {
        setCreatingBooking(true);
        try {
          console.log('🎯 Creating payment intent for', requireAuth ? 'authenticated user' : 'guest user');
          
          // Validate required booking data
          if (!formData.customerEmail || !formData.customerName) {
            throw new Error('Customer information is missing');
          }
          if (!formData.zipcode) {
            throw new Error('Zipcode is required for booking creation');
          }
          if (!formData.selectedDate || !formData.selectedTime) {
            throw new Error('Date and time selection is required');
          }
          if (!services || services.length === 0) {
            throw new Error('At least one service must be selected');
          }

          let paymentIntentResult;

          if (requireAuth && user?.id) {
            // Authenticated user flow - create booking first, then payment intent
            const bookingData = {
              customer_id: user.id,
              service_id: services[0].id,
              scheduled_date: formData.selectedDate,
              scheduled_start: formData.selectedTime,
              location_notes: formData.locationNotes || formData.address,
            };

            paymentIntentResult = await createBookingWithPayment(bookingData, amount);
          } else {
            // Guest user flow - create payment intent first, booking after authorization
            const guestCustomerInfo = {
              email: formData.customerEmail,
              name: formData.customerName,
              phone: formData.customerPhone,
              address: formData.address,
              city: formData.city,
              zipcode: formData.zipcode,
            };

            console.log('Creating payment intent for guest user');
            const { data: intentData, error: intentError } = await supabase.functions.invoke(
              'create-payment-intent',
              {
                body: {
                  amount,
                  currency: 'usd',
                  guest_customer_info: guestCustomerInfo,
                },
              }
            );

            if (intentError || !intentData?.client_secret) {
              throw new Error(intentError?.message || 'Failed to create payment intent');
            }

            paymentIntentResult = {
              success: true,
              client_secret: intentData.client_secret,
              payment_intent_id: intentData.payment_intent_id,
            };

            // Store guest booking data for later creation
            setPaymentRecoveryInfo({
              paymentIntentId: intentData.payment_intent_id,
              amount,
              customerEmail: formData.customerEmail,
              guestBookingData: {
                service_id: services[0].id,
                scheduled_date: formData.selectedDate,
                scheduled_start: formData.selectedTime,
                location_notes: formData.locationNotes || formData.address,
                guest_customer_info: guestCustomerInfo,
              },
              payment_intent_id: intentData.payment_intent_id,
            });
          }
          
          if (!paymentIntentResult.success || !paymentIntentResult.client_secret) {
            const error = paymentIntentResult.error || 'Failed to create payment intent';
            setFormError(error);
            onAuthorizationFailure(error);
            return;
          }

          console.log('Payment intent created, confirming with card...');

          // Confirm payment intent to authorize the card
          const confirmResult = await stripe.confirmCardPayment(paymentIntentResult.client_secret, {
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
            console.log('✅ Payment authorized successfully!');
            
            // For guest users, we need to confirm the payment and create the booking
            if (!requireAuth && paymentRecoveryInfo?.guestBookingData) {
              console.log('Confirming guest payment and creating booking...');
              
              const { data: confirmData, error: confirmError } = await supabase.functions.invoke(
                'confirm-payment',
                {
                  body: {
                    payment_intent_id: confirmResult.paymentIntent.id,
                    guest_booking_data: paymentRecoveryInfo.guestBookingData,
                  },
                }
              );

              if (confirmError || !confirmData?.success) {
                throw new Error(confirmError?.message || 'Failed to confirm payment and create booking');
              }

              console.log('Guest booking created successfully:', confirmData.booking_id);
              onAuthorizationSuccess(confirmData.booking_id);
            } else {
              // Authenticated user flow - booking already exists
              onAuthorizationSuccess(paymentIntentResult.booking_id || bookingId);
            }
          } else {
            const error = 'Payment authorization was not successful';
            setFormError(error);
            onAuthorizationFailure(error);
          }
        } catch (bookingError) {
          const errorMessage = bookingError instanceof Error ? bookingError.message : 'Booking creation failed';
          console.error('Booking creation error:', bookingError);
          setFormError(errorMessage);
          onAuthorizationFailure(errorMessage);
        } finally {
          setCreatingBooking(false);
        }
      } else {
        // Old flow - this shouldn't happen with the new implementation
        const error = 'Invalid booking flow - please refresh and try again';
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

  // Show authentication warning if user is not logged in
  if (authLoading) {
    return (
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Loading authentication status...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Only show auth requirement for requireAuth mode
  if (requireAuth && !user && (services && formData)) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Authentication Required:</strong> You must be logged in to create a booking. 
            Please sign in to continue with your payment.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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

      {formError && !paymentRecoveryInfo && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {paymentRecoveryInfo && (
        <PaymentRecoveryAlert
          paymentIntentId={paymentRecoveryInfo.paymentIntentId}
          customerEmail={paymentRecoveryInfo.customerEmail}
          amount={paymentRecoveryInfo.amount}
        />
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
                  <span className="font-medium">Payment method ready for authorization</span>
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-md">
              <span className="font-semibold">Authorization Amount:</span>
              <span className="text-2xl font-bold text-blue-600">${amount.toFixed(2)}</span>
            </div>

            <Button 
              type="submit"
              disabled={!stripeReady || loading || creatingBooking || !!formError || (requireAuth && !user)}
              className="w-full"
              size="lg"
            >
              {(requireAuth && !user)
                ? 'Please Log In' 
                : loading 
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