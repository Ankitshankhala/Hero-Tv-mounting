import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, CreditCard, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { StripeCardElement } from '@/components/StripeCardElement';
import { supabase } from '@/integrations/supabase/client';
import { useTestingMode } from '@/contexts/TestingModeContext';

interface PaymentAuthorizationFormProps {
  amount: number;
  bookingId: string;
  customerEmail: string;
  customerName: string;
  onAuthorizationSuccess: (bookingId: string) => void;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stripe, setStripe] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [elements, setElements] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cardElement, setCardElement] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isTestingMode } = useTestingMode();

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

    if (!customerEmail || !customerName) {
      const error = 'Customer information is required for payment.';
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    if (!bookingId) {
      const error = 'Booking ID is required for payment authorization.';
      setFormError(error);
      onAuthorizationFailure(error);
      return;
    }

    try {
      setLoading(true);
      
      // Create payment intent for existing booking
      console.log(`🔧 PaymentAuthorizationForm: Sending amount in dollars: $${amount}`);
      const { data: intentData, error: intentError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: {
            amount: amount, // Send in dollars, edge function will convert to cents
            currency: 'usd',
            booking_id: bookingId,
            idempotency_key: crypto.randomUUID(),
            user_id: user?.id || null,
            testing_mode: isTestingMode, // Pass testing mode flag
            guest_customer_info: !user ? {
              email: customerEmail,
              name: customerName,
            } : undefined,
          },
        }
      );

      if (intentError || !intentData?.client_secret) {
        throw new Error(intentError?.message || 'Failed to create payment intent');
      }

      console.log('Payment intent created for existing booking, confirming with card...');
      
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
        
        // Handle payment success and update all statuses
        try {
          const { data: successData, error: successError } = await supabase.functions.invoke(
            'handle-payment-success',
            {
              body: {
                payment_intent_id: intentData.payment_intent_id,
                booking_id: bookingId,
              },
            }
          );

          if (successError || !successData?.success) {
            console.warn('Payment success handler failed:', successError);
            throw new Error(successError?.message || successData?.error || 'Failed to process payment success');
          }

          console.log('Payment success processed and all statuses updated');
          
          onAuthorizationSuccess(intentData.payment_intent_id);
        } catch (error) {
          console.error('Error processing payment success:', error);
          toast({ 
            title: 'Payment Authorized but Processing Failed', 
            description: 'Your payment was authorized but we had trouble updating the booking. Please contact support.', 
            variant: 'destructive' 
          });
          throw new Error('Payment authorized but failed to process success');
        }
      } else {
        throw new Error(`Payment authorization incomplete. Status: ${paymentIntent?.status || 'unknown'}`);
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
              <p>We'll authorize ${amount.toFixed(2)} on your card but won't charge you until the service is completed.</p>
            </div>
          </div>
        </div>

        {(formError || cardError) && (
          <Alert variant="destructive">
            <AlertDescription>{formError || cardError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CreditCard className="inline h-4 w-4 mr-1" />
              Payment Information
            </label>
            
            <StripeCardElement
              onReady={handleStripeReady}
              onError={handleStripeError}
            />
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <p>• Your card will be authorized for ${amount.toFixed(2)}</p>
            <p>• Payment will only be captured after service completion</p>
            <p>• You can cancel anytime before the worker arrives</p>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={!stripeReady || loading || !!cardError}
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