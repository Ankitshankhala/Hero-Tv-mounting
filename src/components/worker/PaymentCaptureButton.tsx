
import React from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle } from 'lucide-react';
import { usePaymentAuthorization } from '@/hooks/usePaymentAuthorization';

interface PaymentCaptureButtonProps {
  bookingId: string;
  paymentStatus: string;
  onCaptureSuccess?: () => void;
}

export const PaymentCaptureButton = ({ 
  bookingId, 
  paymentStatus, 
  onCaptureSuccess 
}: PaymentCaptureButtonProps) => {
  const { capturePayment, processing } = usePaymentAuthorization();

  const handleCapturePayment = async () => {
    const result = await capturePayment(bookingId);
    if (result.success && onCaptureSuccess) {
      onCaptureSuccess();
    }
  };

  // Don't show button if payment is already captured
  if (paymentStatus === 'captured') {
    return (
      <div className="flex items-center space-x-2 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span>Payment Captured</span>
      </div>
    );
  }

  // Only show for authorized payments
  if (paymentStatus !== 'authorized') {
    return null;
  }

  return (
    <Button
      onClick={handleCapturePayment}
      disabled={processing}
      className="bg-green-600 hover:bg-green-700"
    >
      <CreditCard className="h-4 w-4 mr-2" />
      {processing ? 'Capturing...' : 'Complete Job & Collect Payment'}
    </Button>
  );
};
