import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Shield, Clock } from 'lucide-react';
import { useStripePayment } from '@/hooks/useStripePayment';
import { useToast } from '@/hooks/use-toast';

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
  const { createPaymentIntent, confirmCardPayment } = useStripePayment();
  const { toast } = useToast();

  const handleAuthorizePayment = async () => {
    setIsProcessing(true);
    
    try {
      // Create payment intent with manual capture
      const { clientSecret, paymentIntentId } = await createPaymentIntent({
        amount: amount * 100, // Convert to cents
        customerEmail,
        customerName,
        bookingId,
        captureMethod: 'manual'
      });

      if (!clientSecret) {
        throw new Error('Failed to create payment intent');
      }

      // Confirm the payment authorization with test card
      const { paymentIntent, error } = await confirmCardPayment(clientSecret, {
        type: 'card',
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2025,
          cvc: '123'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent?.status === 'requires_capture') {
        toast({
          title: "Payment Authorized",
          description: `$${amount.toFixed(2)} has been authorized on your card. You will only be charged when the service is completed.`,
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
          We'll authorize ${amount.toFixed(2)} on your card. You'll only be charged when the service is completed.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Authorization holds funds but doesn't charge your card
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Payment is only captured when service is completed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Secure processing with Stripe
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleAuthorizePayment}
            disabled={isProcessing}
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
      </CardContent>
    </Card>
  );
};