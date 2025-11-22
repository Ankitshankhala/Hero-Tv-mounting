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
import { withTimeout, PAYMENT_INTENT_TIMEOUT, CARD_CONFIRMATION_TIMEOUT } from '@/utils/paymentTimeout';

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
  const [cardComplete, setCardComplete] = useState(false);
  const [stripeInitialized, setStripeInitialized] = useState(false);
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
    setStripeInitialized(true);
    setFormError('');
    setCardError('');
  };

  const handleStripeChange = ({ errorMessage, complete }: { errorMessage: string; complete: boolean }) => {
    setCardError(errorMessage);
    setCardComplete(complete);
  };

  const handleStripeError = (error: string) => {
    if (error && error.trim()) {
      // Only set formError for critical system errors
      if (error.includes('Payment form container') || error.includes('Payment system') || error.includes('configuration')) {
        setFormError(error);
        setStripeInitialized(false);
      }
    } else {
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
        throw new Error(pmError?.message || 'Failed to create payment method');
      }

      console.log(`🔧 PaymentAuthorizationForm: Using unified endpoint with amount: $${amount}`);
      
      // Use unified payment authorization endpoint (single API call)
      const { data: authData, error: authError } = await withTimeout(
        supabase.functions.invoke(
          'unified-payment-authorization',
          {
            body: {
              amount: amount,
              bookingId: bookingId,
              customerEmail: customerEmail,
              customerName: customerName,
              paymentMethodId: paymentMethod.id,
            },
          }
        ),
        PAYMENT_INTENT_TIMEOUT * 2, // Give more time for unified endpoint
        'unified-payment-authorization'
      );

      if (authError || !authData?.success) {
        throw new Error(authError?.message || authData?.error || 'Failed to authorize payment');
      }

      console.log('✅ Payment authorized successfully:', authData.payment_intent_id);
      console.log(`⚡ Performance: ${authData.performance?.total_ms}ms total (target: <1500ms)`);
      
      toast({
        title: "Payment Authorized",
        description: `Successfully authorized $${amount.toFixed(2)}`,
      });

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
              onChange={handleStripeChange}
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
            disabled={!stripeInitialized || !cardComplete || loading}
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