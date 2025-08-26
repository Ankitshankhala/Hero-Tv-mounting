import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase.functions.invoke('capture-payment-intent', {
        body: { 
          payment_intent_id: transaction.payment_intent_id,
          booking_id: transaction.booking_id 
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        const err: any = error as any;
        const errorMsg = err?.context?.error || err?.message || 'Failed to invoke capture function';
        throw new Error(errorMsg);
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Payment capture failed';
        throw new Error(errorMsg);
      }

      toast({
        title: "Payment Captured Successfully",
        description: `$${transaction.amount.toFixed(2)} has been charged`,
      });

      onCaptureSuccess();

    } catch (error) {
      console.error('Payment capture error:', error);
      toast({
        title: "Payment Capture Failed",
        description: error instanceof Error ? error.message : "Failed to capture payment",
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