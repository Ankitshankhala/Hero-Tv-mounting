import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStripePayment } from '@/hooks/useStripePayment';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Shield } from 'lucide-react';

interface DirectPaymentStepProps {
  bookingData: {
    id?: string;
    totalPrice: number;
    customerName: string;
    customerEmail: string;
  };
  onPaymentSuccess: (sessionId: string) => void;
  onBack: () => void;
}

export const DirectPaymentStep = ({
  bookingData,
  onPaymentSuccess,
  onBack
}: DirectPaymentStepProps) => {
  const { createCheckoutSession, processing } = useStripePayment();
  const { toast } = useToast();

  const handlePayment = async () => {
    if (!bookingData.id) {
      toast({
        title: "Error",
        description: "Booking ID is required for payment",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createCheckoutSession({
        bookingId: bookingData.id,
        amount: bookingData.totalPrice,
        description: `${bookingData.customerName} - Service Booking`,
        customerEmail: bookingData.customerEmail
      });

      if (result.success && result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      console.error('Payment failed:', error);
      toast({
        title: "Payment Failed",
        description: "Unable to process payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Complete Your Payment</h2>
        <p className="text-muted-foreground mt-2">
          You'll be redirected to our secure payment page to complete your booking.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Service Total:</span>
            <span className="font-semibold">${bookingData.totalPrice.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
            <span>Total Amount:</span>
            <span>${bookingData.totalPrice.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Shield className="h-4 w-4" />
            <span>Secure payment powered by Stripe. Your payment information is encrypted and secure.</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={processing}
          className="flex-1"
        >
          Back to Schedule
        </Button>
        
        <Button
          onClick={handlePayment}
          disabled={processing}
          className="flex-1"
        >
          {processing ? "Processing..." : "Pay Now"}
        </Button>
      </div>
    </div>
  );
};