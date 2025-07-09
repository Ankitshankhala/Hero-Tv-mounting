import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { usePaymentAuthorization } from '@/hooks/usePaymentAuthorization';
import { useToast } from '@/hooks/use-toast';

interface PaymentCaptureButtonProps {
  transaction: {
    id: string;
    booking_id: string;
    status: string;
    payment_intent_id?: string;
    amount: number;
  };
  onCaptureSuccess: () => void;
}

export const PaymentCaptureButton = ({ transaction, onCaptureSuccess }: PaymentCaptureButtonProps) => {
  const [capturing, setCapturing] = useState(false);
  const { capturePayment } = usePaymentAuthorization();
  const { toast } = useToast();

  const handleCapture = async () => {
    if (!transaction.payment_intent_id) {
      toast({
        title: "Cannot Capture Payment",
        description: "No payment intent ID found for this transaction",
        variant: "destructive",
      });
      return;
    }

    setCapturing(true);
    try {
      const result = await capturePayment(transaction.booking_id);
      if (result.success) {
        toast({
          title: "Payment Captured",
          description: `Successfully captured $${transaction.amount.toFixed(2)}`,
        });
        onCaptureSuccess();
      }
    } catch (error) {
      console.error('Payment capture error:', error);
      toast({
        title: "Capture Failed",
        description: "Failed to capture payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCapturing(false);
    }
  };

  // Only show capture button for authorized payments
  if (transaction.status !== 'authorized') {
    return null;
  }

  return (
    <Button
      onClick={handleCapture}
      disabled={capturing}
      size="sm"
      variant="outline"
      className="ml-2"
    >
      {capturing ? (
        <>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Capturing...
        </>
      ) : (
        <>
          <CreditCard className="h-3 w-3 mr-1" />
          Capture
        </>
      )}
    </Button>
  );
};