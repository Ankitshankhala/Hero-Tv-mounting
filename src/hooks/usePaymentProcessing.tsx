import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentResult {
  success: boolean;
  error?: string;
  transactionId?: string;
  requiresCapture?: boolean;
}

export const usePaymentProcessing = () => {
  const [processing, setProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const verifyPayment = async (sessionId: string): Promise<PaymentResult> => {
    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment-session', {
        body: { sessionId }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        // Handle requires_capture status for authorization flows
        if (data?.requires_capture) {
          return {
            success: true,
            transactionId: data.transaction_id,
            requiresCapture: true
          };
        }
        throw new Error(data?.error || 'Payment verification failed');
      }

      return {
        success: true,
        transactionId: data.transaction_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment verification failed';
      console.error('Payment verification error:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setProcessing(false);
    }
  };

  const processOnlinePayment = async (paymentData: any): Promise<PaymentResult> => {
    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-online-payment', {
        body: paymentData
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Online payment failed');
      }

      toast({
        title: "Payment Processed",
        description: "Payment has been processed successfully",
      });

      return {
        success: true,
        transactionId: data.transaction_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Online payment failed';
      console.error('Online payment error:', error);
      
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setProcessing(false);
    }
  };

  const retryPayment = async (paymentFunction: () => Promise<PaymentResult>): Promise<PaymentResult> => {
    const maxRetries = 3;
    
    if (retryCount >= maxRetries) {
      return {
        success: false,
        error: 'Maximum retry attempts reached'
      };
    }

    setRetryCount(prev => prev + 1);
    const result = await paymentFunction();
    
    if (result.success) {
      setRetryCount(0);
    }

    return result;
  };

  return {
    processOnlinePayment,
    verifyPayment,
    retryPayment,
    processing,
    retryCount
  };
};