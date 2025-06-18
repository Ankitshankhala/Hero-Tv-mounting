
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UsePaymentProcessingProps {
  job: any;
  onPaymentCollected: () => void;
  onClose: () => void;
}

export const usePaymentProcessing = ({ 
  job, 
  onPaymentCollected, 
  onClose 
}: UsePaymentProcessingProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processPayment = async (paymentMethod: 'cash' | 'online', amount: string, notes: string) => {
    setIsProcessing(true);
    
    try {
      const paymentAmount = parseFloat(amount);
      
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Record the transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          booking_id: job.id,
          amount: paymentAmount,
          status: 'completed',
          payment_method: paymentMethod
        });

      if (transactionError) throw transactionError;

      toast({
        title: "Payment Collected",
        description: `Successfully collected $${amount} via ${paymentMethod}`,
      });

      onPaymentCollected();
      onClose();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Payment Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    processPayment
  };
};
