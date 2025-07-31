import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { recordCashPayment } from '@/utils/transactionManager';
import { useStripePayment } from '@/hooks/useStripePayment';

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
  const { createCheckoutSession } = useStripePayment();

  const processPayment = async (paymentMethod: 'cash' | 'online', amount: string, notes: string) => {
    setIsProcessing(true);
    
    try {
      const paymentAmount = parseFloat(amount);
      
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // For cash payments, record the transaction immediately
      if (paymentMethod === 'cash') {
        const transactionResult = await recordCashPayment({
          booking_id: job.id,
          amount: paymentAmount,
          currency: 'USD',
        });

        if (!transactionResult.success) {
          throw new Error(transactionResult.error || 'Failed to record cash payment');
        }

        // Update booking to clear pending payment amount
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ pending_payment_amount: 0 })
          .eq('id', job.id);

        if (updateError) {
          console.error('Failed to update booking:', updateError);
          throw updateError;
        }

        toast({
          title: "Cash Payment Collected",
          description: `Successfully collected $${amount} in cash`,
        });
      } else {
        // For online payments, create a checkout session
        const checkoutResult = await createCheckoutSession({
          bookingId: job.id,
          amount: paymentAmount,
          description: `Payment for ${job.service_name || 'service'}`,
          customerEmail: job.customer_email
        });

        if (!checkoutResult.success) {
          throw new Error(checkoutResult.error || 'Failed to create checkout session');
        }

        // Open checkout URL in new tab
        if (checkoutResult.checkoutUrl) {
          window.open(checkoutResult.checkoutUrl, '_blank');
        }

        toast({
          title: "Payment Checkout Created",
          description: "Payment checkout has been opened for the customer",
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