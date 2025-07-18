import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const usePaymentCancellation = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const cancelPayment = async (paymentIntentId: string, reason?: string) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('cancel-payment-intent', {
        body: {
          paymentIntentId,
          reason: reason || 'manual_cancellation'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel payment');
      }

      toast({
        title: "Payment Cancelled",
        description: data.message,
      });

      return {
        success: true,
        cancellationType: data.cancellationType,
        refundAmount: data.refundAmount,
        message: data.message
      };

    } catch (error) {
      console.error('Payment cancellation error:', error);
      
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : "Failed to cancel payment",
        variant: "destructive",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    } finally {
      setLoading(false);
    }
  };

  const refundPayment = async (paymentIntentId: string, amount?: number, reason?: string) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('cancel-payment-intent', {
        body: {
          paymentIntentId,
          refundAmount: amount,
          reason: reason || 'manual_refund'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to process refund');
      }

      toast({
        title: "Refund Processed",
        description: data.message,
      });

      return {
        success: true,
        cancellationType: data.cancellationType,
        refundAmount: data.refundAmount,
        message: data.message
      };

    } catch (error) {
      console.error('Refund processing error:', error);
      
      toast({
        title: "Refund Failed",
        description: error instanceof Error ? error.message : "Failed to process refund",
        variant: "destructive",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    cancelPayment,
    refundPayment,
    loading
  };
};