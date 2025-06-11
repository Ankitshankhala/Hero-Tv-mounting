
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UsePaymentProcessingProps {
  job: any;
  onPaymentCollected: () => void;
  onClose: () => void;
}

export const usePaymentProcessing = ({ job, onPaymentCollected, onClose }: UsePaymentProcessingProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processPayment = async (paymentMethod: 'cash' | 'online', amount: string, notes: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (paymentMethod === 'online') {
        // Process online payment
        const { data, error } = await supabase.functions.invoke('process-onsite-payment', {
          body: {
            chargeId: `charge_${Date.now()}`,
            customerId: job.customer_id,
            amount: Math.round(parseFloat(amount) * 100), // Convert to cents
            description: `Payment for Job #${job.id.slice(0, 8)} - ${job.services?.map((s: any) => s.name).join(', ')}`
          }
        });

        if (error) {
          throw new Error(error.message || 'Online payment failed');
        }

        console.log('Online payment processed:', data);
      }

      // Record the payment transaction - using 'success' instead of 'completed'
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          booking_id: job.id,
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          status: 'success',
          processed_at: new Date().toISOString()
        });

      if (transactionError) {
        throw new Error('Failed to record transaction');
      }

      // Update the booking to reduce pending payment amount
      const remainingAmount = Math.max(0, (job.pending_payment_amount || 0) - parseFloat(amount));
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          pending_payment_amount: remainingAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        throw new Error('Failed to update booking payment status');
      }

      toast({
        title: "Payment Collected",
        description: `Successfully collected $${amount} via ${paymentMethod}`,
      });

      onPaymentCollected();
      onClose();

    } catch (error: any) {
      console.error('Payment collection error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment",
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
