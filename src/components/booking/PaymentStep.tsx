
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, CreditCard, Info } from 'lucide-react';
import { PaymentAuthorizationForm } from '@/components/payment/PaymentAuthorizationForm';
import { useToast } from '@/hooks/use-toast';

interface PaymentStepProps {
  bookingId: string;
  totalPrice: number;
  customerEmail: string;
  customerName: string;
  onPaymentAuthorized: () => void;
  onBack: () => void;
}

export const PaymentStep = ({
  bookingId,
  totalPrice,
  customerEmail,
  customerName,
  onPaymentAuthorized,
  onBack
}: PaymentStepProps) => {
  const [authorizationError, setAuthorizationError] = useState('');
  const { toast } = useToast();

  // Validate required props
  useEffect(() => {
    if (!bookingId) {
      console.error('PaymentStep: Missing booking ID');
      setAuthorizationError('Booking information is missing. Please go back and try again.');
    }
    if (!totalPrice || totalPrice <= 0) {
      console.error('PaymentStep: Invalid total price:', totalPrice);
      setAuthorizationError('Invalid price information. Please go back and check your service selection.');
    }
    if (!customerEmail || !customerName) {
      console.error('PaymentStep: Missing customer information');
      setAuthorizationError('Customer information is missing. Please go back and fill in your details.');
    }
  }, [bookingId, totalPrice, customerEmail, customerName]);

  const handleAuthorizationSuccess = () => {
    console.log('Payment authorization successful for booking:', bookingId);
    toast({
      title: "Payment Authorized",
      description: "Your payment method has been authorized successfully. You will be charged after service completion.",
    });
    onPaymentAuthorized();
  };

  const handleAuthorizationFailure = (error: string) => {
    console.error('Payment authorization failed:', error);
    setAuthorizationError(error);
  };

  // Show error if we have validation issues
  if (authorizationError && (!bookingId || !totalPrice || !customerEmail || !customerName)) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>{authorizationError}</AlertDescription>
        </Alert>
        <Button onClick={onBack} variant="outline" className="w-full">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Authorization</h2>
        <p className="text-gray-600">
          Authorize your payment method. You will be charged ${totalPrice.toFixed(2)} after service completion.
        </p>
      </div>

      {authorizationError && (
        <Alert variant="destructive">
          <AlertDescription>{authorizationError}</AlertDescription>
        </Alert>
      )}

      <PaymentAuthorizationForm
        amount={totalPrice}
        bookingId={bookingId}
        customerEmail={customerEmail}
        customerName={customerName}
        onAuthorizationSuccess={handleAuthorizationSuccess}
        onAuthorizationFailure={handleAuthorizationFailure}
      />

      <div className="flex space-x-4">
        <Button 
          onClick={onBack} 
          variant="outline" 
          className="flex-1"
        >
          Back to Schedule
        </Button>
      </div>
    </div>
  );
};
