import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Lock, Shield } from 'lucide-react';
import { StripeCardElement } from '@/components/StripeCardElement';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface InlineStripePaymentFormProps {
  job: any;
  amount: string;
  clientSecret?: string; // For confirming existing PaymentIntents
  onPaymentSuccess: () => void;
  onPaymentFailure?: (error: string) => void;
}

export const InlineStripePaymentForm = ({ 
  job, 
  amount, 
  clientSecret,
  onPaymentSuccess,
  onPaymentFailure 
}: InlineStripePaymentFormProps) => {
  const [stripe, setStripe] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState('');
  const { toast } = useToast();

  const handleStripeReady = (stripeInstance: any, elements: any, cardEl: any) => {
    setStripe(stripeInstance);
    setCardElement(cardEl);
  };

  const handlePayment = async () => {
    if (!stripe || !cardElement) {
      const error = 'Payment form not ready. Please try again.';
      onPaymentFailure?.(error);
      toast({
        title: "Payment Error",
        description: error,
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      if (clientSecret) {
        // Confirm existing PaymentIntent using client secret
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        console.log('PaymentIntent status:', paymentIntent.status);
        
        // Check for successful payment statuses
        if (['succeeded', 'processing', 'requires_capture'].includes(paymentIntent.status)) {
          // Update transaction status via edge function
          const { data, error: updateError } = await supabase.functions.invoke('process-service-addition-payment', {
            body: {
              payment_intent_id: paymentIntent.id,
              booking_id: job.id
            }
          });

          if (updateError) {
            console.error('Edge function error:', updateError);
            throw new Error(updateError.message);
          }

          toast({
            title: "Payment Successful",
            description: `Successfully charged $${amount} for additional services`,
          });

          onPaymentSuccess();
        } else {
          console.error('Unexpected PaymentIntent status:', paymentIntent.status);
          throw new Error(`Payment status: ${paymentIntent.status}. Please contact support if you were charged.`);
        }

      } else {
        // Create new payment method and process through edge function (original flow)
        const { error, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
        });

        if (error) {
          throw new Error(error.message);
        }

        // Get customer information
        const customerEmail = job.customer?.email || job.guest_customer_info?.email;
        const customerName = job.customer?.name || job.guest_customer_info?.name;
        
        const amountInDollars = parseFloat(amount);

        // Process the payment through edge function
        const { data, error: functionError } = await supabase.functions.invoke('process-manual-charge', {
          body: {
            bookingId: job.id,
            customerId: job.customer?.id || null,
            paymentMethodId: paymentMethod.id,
            amount: amountInDollars,
            chargeType: 'additional_services',
            description: `Additional services for Booking #${job.id.slice(0, 8)} - $${amount}`
          }
        });

        if (functionError) {
          throw new Error(functionError.message);
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Payment processing failed');
        }

        toast({
          title: "Payment Successful",
          description: `Successfully charged $${amount} for additional services`,
        });

        onPaymentSuccess();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
      console.error('Payment error:', error);
      
      onPaymentFailure?.(errorMessage);
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const customerInfo = job.customer || job.guest_customer_info;

  return (
    <div className="space-y-4">
      {/* Security Badge */}
      <Alert className="bg-slate-800 border-slate-600">
        <Shield className="h-4 w-4 text-green-400" />
        <AlertDescription className="flex items-center space-x-2 text-slate-300">
          <Lock className="h-3 w-3 text-green-400" />
          <span>Payment is encrypted and secure</span>
        </AlertDescription>
      </Alert>

      {/* Payment Amount Display */}
      <div className="bg-slate-700 p-4 rounded-lg">
        <div className="flex justify-between items-center text-white">
          <span>Payment Amount:</span>
          <span className="text-xl font-bold">${amount}</span>
        </div>
      </div>

      {/* Customer Information */}
      {customerInfo && (
        <div className="bg-slate-700 p-3 rounded-lg">
          <h4 className="text-white font-medium mb-2">Customer Information</h4>
          <div className="text-slate-300 text-sm space-y-1">
            <p>Name: {customerInfo.name}</p>
            <p>Email: {customerInfo.email}</p>
            {customerInfo.phone && <p>Phone: {customerInfo.phone}</p>}
          </div>
        </div>
      )}

      {/* Card Input Form */}
      <Card className="bg-slate-800 border-slate-600">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
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

      {/* Payment Button */}
      <Button 
        onClick={handlePayment}
        disabled={processing || !stripe || !!cardError}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        {processing ? 'Processing Payment...' : `Charge $${amount}`}
      </Button>

      {/* Information */}
      <div className="text-slate-400 text-xs bg-slate-700 p-3 rounded-lg">
        <p className="font-medium mb-1">Secure Payment Processing:</p>
        <ul className="space-y-1">
          <li>• Payment processed immediately through Stripe</li>
          <li>• Customer's card is charged in real-time</li>
          <li>• Booking status updated automatically</li>
          <li>• Receipt sent to customer email</li>
        </ul>
      </div>
    </div>
  );
};