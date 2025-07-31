import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info, AlertTriangle } from 'lucide-react';
// Removed useBookingPaymentFlow import that was causing Stripe context issues
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { StripeCardElement } from '@/components/StripeCardElement';
import { PaymentRecoveryAlert } from './PaymentRecoveryAlert';
import { supabase } from '@/integrations/supabase/client';
import { FormData, ServiceItem } from '@/hooks/booking/types';

interface PaymentAuthorizationFormProps {
  amount: number;
  bookingId?: string;
  customerEmail?: string;
  customerName?: string;
  services?: ServiceItem[];
  formData?: FormData;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stripe, setStripe] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [elements, setElements] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cardElement, setCardElement] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [paymentRecoveryInfo, setPaymentRecoveryInfo] = useState<{
    paymentIntentId: string;
    amount: number;
    customerEmail?: string;
    guestBookingData?: Record<string, unknown>;
    payment_intent_id?: string;
  } | null>(null);
  
  // Remove useBookingPaymentFlow hook that requires Stripe context
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStripeReady = (stripeInstance: any, elementsInstance: any, cardElementInstance: any) => {
    setStripe(stripeInstance);
    setElements(elementsInstance);
    setCardElement(cardElementInstance);
    setStripeReady(true);
    setFormError('');
    setCardError('');
  };

  const handleStripeError = (error: string) => {
    if (error && error.trim()) {
      setCardError(error);
      setFormError(error);
      setStripeReady(false);
    } else {
      setCardError('');
      if (formError && !formError.includes('Payment form not ready') && !formError.includes('Payment system')) {
        setFormError('');
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Payment authorization started

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

    if (!requireAuth && (!customerEmail || !customerName)) {
      const error = 'Customer information is required for payment.';
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    try {

      // Handle booking creation - different flow for authenticated vs guest users
      if (services && formData && !bookingId) {
        setCreatingBooking(true);
        try {
          // Creating payment intent
          
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

          // Create payment intent using direct Supabase call
          const guestCustomerInfo = !requireAuth ? {
            email: formData.customerEmail,
            name: formData.customerName,
            phone: formData.customerPhone,
            address: formData.address,
            city: formData.city,
            zipcode: formData.zipcode,
          } : undefined;

          // Generate idempotency key for this payment attempt
          const idempotencyKey = crypto.randomUUID();
          
          const { data: intentData, error: intentError } = await supabase.functions.invoke(
            'create-payment-intent',
            {
              body: {
                amount,
                currency: 'usd',
                idempotency_key: idempotencyKey,
                guest_customer_info: guestCustomerInfo,
                user_id: requireAuth && user?.id ? user.id : undefined,
              },
            }
          );

          if (intentError || !intentData?.client_secret) {
            throw new Error(intentError?.message || 'Failed to create payment intent');
          }

          // Store payment intent data
          setPaymentRecoveryInfo({
            paymentIntentId: intentData.payment_intent_id,
            amount,
            customerEmail: String(formData.customerEmail),
            guestBookingData: !requireAuth && services && services.length > 0 ? {
              service_id: services[0].id,
              scheduled_date: formData.selectedDate,
              scheduled_start: formData.selectedTime,
              location_notes: formData.address,
              guest_customer_info: guestCustomerInfo,
            } : undefined,
            payment_intent_id: intentData.payment_intent_id,
          });

          // Confirm payment intent to authorize the card with 3D Secure support
          setLoading(true);
          
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
          if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
            
            // Update transaction status to 'authorized' after successful payment
            try {
              const { data: updateData, error: updateError } = await supabase.functions.invoke(
                'update-transaction-status',
                {
                  body: {
                    payment_intent_id: intentData.payment_intent_id,
                    status: 'authorized',
                  },
                }
              );

              if (updateError || !updateData?.success) {
                throw new Error(updateError?.message || updateData?.error || 'Failed to update transaction status');
              }

              // Transaction status updated to authorized
            } catch (error) {
              console.error('Error updating transaction status:', error);
              const errorMessage = 'Payment authorized but failed to update transaction status';
              setFormError(errorMessage);
              toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
              onAuthorizationFailure(errorMessage);
              return;
            }
            
            // Create booking after successful payment authorization and transaction update
            if (!requireAuth && paymentRecoveryInfo?.guestBookingData) {
              console.log('Creating guest booking after payment authorization...');
              
              const { data: bookingData, error: bookingError } = await supabase.functions.invoke(
                'create-booking',
                {
                  body: {
                    payment_intent_id: intentData.payment_intent_id,
                    booking_payload: paymentRecoveryInfo.guestBookingData,
                  },
                }
              );

              if (bookingError || !bookingData?.success) {
                throw new Error(bookingError?.message || 'Failed to create booking after payment authorization');
              }

              console.log('Guest booking created successfully:', bookingData.booking_id);
              onAuthorizationSuccess(bookingData.booking_id);
            } else if (requireAuth && services && services.length > 0) {
              // For authenticated users, create booking
              const bookingPayload = {
                customer_id: user?.id,
                service_id: services[0].id,
                scheduled_date: formData.selectedDate,
                scheduled_start: formData.selectedTime,
                location_notes: formData.address,
              };

              const { data: bookingData, error: bookingError } = await supabase.functions.invoke(
                'create-booking',
                {
                  body: {
                    payment_intent_id: intentData.payment_intent_id,
                    booking_payload: bookingPayload,
                  },
                }
              );

              if (bookingError || !bookingData?.success) {
                throw new Error(bookingError?.message || 'Failed to create booking after payment authorization');
              }

              console.log('Authenticated user booking created successfully:', bookingData.booking_id);
              onAuthorizationSuccess(bookingData.booking_id);
            } else {
              onAuthorizationSuccess(intentData.payment_intent_id);
            }
          } else {
            const error = `Payment authorization incomplete. Status: ${paymentIntent?.status || 'unknown'}`;
            console.error('Payment not authorized:', paymentIntent?.status);
            setFormError(error);
            onAuthorizationFailure(error);
          }
        } catch (bookingError) {
          const errorMessage = bookingError instanceof Error ? bookingError.message : 'Booking creation failed';
          console.error('Booking creation error:', bookingError);
          setFormError(errorMessage);
          toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
          onAuthorizationFailure(errorMessage);
        } finally {
          setCreatingBooking(false);
        }
      } else if (bookingId) {
        // Payment authorization for existing booking
        console.log('🎯 Authorizing payment for existing booking:', bookingId);
        
          try {
            // Prepare user data for authentication
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const paymentRequestBody: any = {
            amount,
            currency: 'usd',
            booking_id: bookingId,
            idempotency_key: crypto.randomUUID(),
          };

          // Add authentication data
          if (user) {
            paymentRequestBody.user_id = user.id;
          } else {
            // For guest bookings, get guest info from formData or props
            paymentRequestBody.guest_customer_info = {
              email: customerEmail || formData?.customerEmail,
              name: customerName || formData?.customerName,
            };
          }
          
          // Create payment intent for existing booking
          const { data: intentData, error: intentError } = await supabase.functions.invoke(
            'create-payment-intent',
            {
              body: paymentRequestBody,
            }
          );

          if (intentError || !intentData?.client_secret) {
            throw new Error(intentError?.message || 'Failed to create payment intent for existing booking');
          }

          console.log('Payment intent created for existing booking, confirming with card...');
          
          setLoading(true);
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
            let errorMessage = 'Payment authorization failed';
            const stripeError = confirmResult.error;
            
            switch (stripeError.type) {
              case 'card_error':
                if (stripeError.code === 'card_declined') {
                  errorMessage = 'Your card was declined. Please try a different payment method.';
                } else if (stripeError.code === 'authentication_required') {
                  errorMessage = 'Authentication failed. Please try again or use a different card.';
                } else {
                  errorMessage = stripeError.message || 'There was an issue with your card. Please try again.';
                }
                break;
              default:
                errorMessage = stripeError.message || 'Payment authorization failed. Please try again.';
            }
            
            throw new Error(errorMessage);
          }

          const paymentIntent = confirmResult.paymentIntent;
          console.log('Payment intent status after confirmation:', paymentIntent?.status);

          if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
            console.log('✅ Payment authorized successfully for existing booking!');
            
            // Update transaction status to 'authorized'
            try {
              const { data: updateData, error: updateError } = await supabase.functions.invoke(
                'update-transaction-status',
                {
                  body: {
                    payment_intent_id: intentData.payment_intent_id,
                    status: 'authorized',
                  },
                }
              );

              if (updateError || !updateData?.success) {
                throw new Error(updateError?.message || updateData?.error || 'Failed to update transaction status');
              }

              console.log('Transaction status updated to authorized for existing booking');
              onAuthorizationSuccess(bookingId);
            } catch (error) {
              console.error('Error updating transaction status:', error);
              toast({ title: 'Error', description: 'Payment authorized but failed to update transaction status', variant: 'destructive' });
              throw new Error('Payment authorized but failed to update transaction status');
            }
          } else {
            throw new Error(`Payment authorization incomplete. Status: ${paymentIntent?.status || 'unknown'}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Payment authorization failed for existing booking';
          console.error('Existing booking payment error:', error);
          setFormError(errorMessage);
          toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
          onAuthorizationFailure(errorMessage);
        }
      } else {
        // Invalid flow - missing required data
        const error = 'Invalid payment flow: Missing booking data or booking ID. Please refresh and try again.';
        console.error('Invalid flow state:', { bookingId, hasServices: !!services, hasFormData: !!formData });
        setFormError(error);
        onAuthorizationFailure(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment authorization failed';
      console.error('Payment authorization error:', error);
      setFormError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      onAuthorizationFailure(errorMessage);
    } finally {
      setLoading(false);
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
                  ? 'Processing Payment...' 
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