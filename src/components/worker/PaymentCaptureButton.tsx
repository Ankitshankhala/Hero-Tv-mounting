
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleCapturePayment = async () => {
    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('capture-payment-intent', {
        body: { booking_id: bookingId }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Payment capture failed');
      }

      toast({
        title: "Payment Captured Successfully",
        description: "Job marked as completed and customer's payment has been charged",
      });

      if (onCaptureSuccess) {
        onCaptureSuccess();
      }

    } catch (error) {
      console.error('Payment capture error:', error);
      toast({
        title: "Payment Capture Failed",
        description: error instanceof Error ? error.message : "Failed to capture payment",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
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
      {processing ? 'Processing Payment...' : 'Mark Complete & Charge Customer'}
    </Button>
  );
};
