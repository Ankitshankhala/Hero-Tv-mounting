
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PaymentAuthorizationForm } from '@/components/payment/PaymentAuthorizationForm';
import { useToast } from '@/hooks/use-toast';

interface PaymentStepProps {
  bookingId: string;
  totalPrice: number;
  customerEmail: string;
  customerName: string;
  onPaymentAuthorized: () => void;
  onBack: () => void;
  requireAuth?: boolean;
}

export const PaymentStep = ({
  bookingId,
  totalPrice,
  customerEmail,
  customerName,
  onPaymentAuthorized,
  onBack,
  requireAuth = false
}: PaymentStepProps) => {
  const [authorizationError, setAuthorizationError] = useState('');
  const [isValidatingBooking, setIsValidatingBooking] = useState(true);
  const { toast } = useToast();

  // Validate required props and booking
  useEffect(() => {
    const validateProps = async () => {
      console.log('🔄 Validating payment step props:', { bookingId, totalPrice, customerEmail, customerName });
      
      // Basic validation
      if (!bookingId) {
        console.error('PaymentStep: Missing booking ID');
        setAuthorizationError('Booking information is missing. Please go back and try again.');
        setIsValidatingBooking(false);
        return;
      }
      
      if (!totalPrice || totalPrice <= 0) {
        console.error('PaymentStep: Invalid total price:', totalPrice);
        setAuthorizationError('Invalid price information. Please go back and check your service selection.');
        setIsValidatingBooking(false);
        return;
      }
      
      if (!customerEmail || !customerName) {
        console.error('PaymentStep: Missing customer information');
        setAuthorizationError('Customer information is missing. Please go back and fill in your details.');
        setIsValidatingBooking(false);
        return;
      }

      // Test booking ID validation
      if (bookingId === 'test-booking-id') {
        setAuthorizationError('Test booking ID detected. This cannot be used for real payments.');
        setIsValidatingBooking(false);
        return;
      }

      console.log('✅ Payment step validation passed');
      setAuthorizationError('');
      setIsValidatingBooking(false);
    };

    validateProps();
  }, [bookingId, totalPrice, customerEmail, customerName]);

  const handleAuthorizationSuccess = () => {
    console.log('✅ Payment authorization successful for booking:', bookingId);
    toast({
      title: "Payment Authorized! 🎉",
      description: "Your payment method has been authorized successfully. You will be charged after service completion.",
    });
    onPaymentAuthorized();
  };

  const handleAuthorizationFailure = (error: string) => {
    console.error('❌ Payment authorization failed:', error);
    setAuthorizationError(error);
    
    // Provide helpful guidance based on error type
    if (error.includes('booking')) {
      toast({
        title: "Booking Issue",
        description: "There was a problem with your booking. Please try creating a new booking.",
        variant: "destructive",
      });
    } else if (error.includes('payment')) {
      toast({
        title: "Payment Setup Issue",
        description: "Please check your payment information and try again.",
        variant: "destructive",
      });
    }
  };

  // Show loading state while validating
  if (isValidatingBooking) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating booking information...</p>
        </div>
      </div>
    );
  }

  // Show error if we have validation issues
  if (authorizationError && (!bookingId || !totalPrice || !customerEmail || !customerName || bookingId === 'test-booking-id')) {
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
          {requireAuth 
            ? `Authorize your payment method. You will be charged $${totalPrice.toFixed(2)} after service completion.`
            : `Authorize your payment method as a guest. You will be charged $${totalPrice.toFixed(2)} after service completion.`
          }
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
        requireAuth={requireAuth}
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
