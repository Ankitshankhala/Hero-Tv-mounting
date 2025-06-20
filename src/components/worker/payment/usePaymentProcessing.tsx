
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

      // For cash payments, record the transaction immediately
      if (paymentMethod === 'cash') {
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            booking_id: job.id,
            amount: paymentAmount,
            status: 'completed',
            payment_method: paymentMethod,
          });

        if (transactionError) throw transactionError;

        // Update booking to clear pending payment using the edge function
        const { error: updateError } = await supabase.functions.invoke('update-booking-payment', {
          body: {
            booking_id: job.id,
            new_pending_amount: 0
          }
        });

        if (updateError) {
          console.error('Failed to update booking:', updateError);
          throw updateError;
        }

        toast({
          title: "Cash Payment Collected",
          description: `Successfully collected $${amount} in cash`,
        });
      } else {
        // For online payments, we just show success since the payment link handles the transaction
        toast({
          title: "Online Payment Initiated",
          description: "Payment link has been created for the customer",
        });
      }

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
