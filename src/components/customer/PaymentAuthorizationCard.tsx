import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Shield, Clock } from 'lucide-react';
import { useStripePayment } from '@/hooks/useStripePayment';
import { useToast } from '@/hooks/use-toast';
import { StripeCardElement } from '@/components/StripeCardElement';
import { supabase } from '@/integrations/supabase/client';

interface PaymentAuthorizationCardProps {
  bookingId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  onAuthorizationSuccess: (paymentIntentId: string) => void;
  onCancel?: () => void;
}

export const PaymentAuthorizationCard = ({
  bookingId,
  amount,
  customerName,
  customerEmail,
  onAuthorizationSuccess,
  onCancel
}: PaymentAuthorizationCardProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCardReady, setIsCardReady] = useState(false);
  const [cardError, setCardError] = useState('');
  const { confirmCardPayment } = useStripePayment();
  const { toast } = useToast();
  
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const cardElementRef = useRef<any>(null);

  const handleStripeReady = (stripe: any, elements: any, cardElement: any) => {
    console.log('Stripe ready for payment authorization');
    stripeRef.current = stripe;
    elementsRef.current = elements;
    cardElementRef.current = cardElement;
    setIsCardReady(true);
  };

  const handleStripeError = (error: string) => {
    console.log('✅ Stripe error cleared, card validation successful');
    setCardError(error);
  };

  const handleAuthorizePayment = async () => {
    if (!isCardReady || !stripeRef.current || !cardElementRef.current) {
      toast({
        title: "Card Not Ready",
        description: "Please wait for the payment form to load completely and enter your card details.",
        variant: "destructive",
      });
      return;
    }

    if (cardError) {
      toast({
        title: "Card Invalid",
        description: cardError,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('💳 Payment authorization started:', {
        hasStripe: !!stripeRef.current,
        hasElements: !!elementsRef.current,
        hasCardElement: !!cardElementRef.current,
        amount,
        customerEmail,
        bookingId
      });
      
      console.log('Starting payment authorization process...');
      
      // Create payment intent with manual capture using Supabase function directly
      const { data, error: intentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: amount, // Pass amount in dollars, edge function will convert to cents
          currency: 'usd',
          booking_id: bookingId,
          idempotency_key: crypto.randomUUID(),
          user_id: null, // This is for customer dashboard use
        }
      });

      if (intentError || !data?.client_secret) {
        throw new Error(intentError?.message || 'Failed to create payment intent');
      }

      const { client_secret: clientSecret, payment_intent_id: paymentIntentId } = data;

      if (!clientSecret) {
        throw new Error('Failed to create payment intent');
      }

      // Confirm the payment authorization with the real card element
      const { paymentIntent, error: stripeError } = await stripeRef.current.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElementRef.current,
          billing_details: {
            name: customerName,
            email: customerEmail,
          },
        }
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent?.status === 'requires_capture') {
      toast({
        title: "Payment Authorized Successfully",
        description: `Your booking is confirmed! $${amount.toFixed(2)} is authorized and will be charged when service is completed.`,
      });
        onAuthorizationSuccess(paymentIntentId);
      } else {
        throw new Error(`Unexpected payment status: ${paymentIntent?.status}`);
      }

    } catch (error) {
      console.error('Payment authorization error:', error);
      toast({
        title: "Authorization Failed",
        description: error instanceof Error ? error.message : "Failed to authorize payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Secure Payment Authorization</CardTitle>
        <CardDescription>
          We'll authorize ${amount.toFixed(2)} on your card to secure your booking. The actual charge will only occur when your service is completed by our technician.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-foreground">
              <strong>Step 1:</strong> Authorization secures your booking without charging your card
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm text-foreground">
              <strong>Step 2:</strong> Our technician completes your service
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-foreground">
              <strong>Step 3:</strong> Payment is charged only after service completion
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Card Details
            </label>
            <StripeCardElement
              onReady={handleStripeReady}
              onError={handleStripeError}
            />
          </div>
          
          <div className="space-y-3">
            <Button
              onClick={handleAuthorizePayment}
              disabled={isProcessing || !isCardReady || !!cardError}
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {isProcessing ? 'Authorizing...' : `Authorize $${amount.toFixed(2)}`}
            </Button>
            
            {onCancel && (
              <Button
                onClick={onCancel}
                variant="outline"
                className="w-full"
                disabled={isProcessing}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};