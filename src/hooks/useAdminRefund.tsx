import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RefundOptions {
  bookingId: string;
  refundAmount?: number;
  reason: string;
  notifyCustomer?: boolean;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  refundAmount?: number;
  refundType?: 'full' | 'partial';
  cancellationType?: string;
  message?: string;
  error?: string;
}

export const useAdminRefund = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const processRefund = async ({
    bookingId,
    refundAmount,
    reason,
    notifyCustomer = true
  }: RefundOptions): Promise<RefundResult> => {
    setLoading(true);

    try {
      console.log('Processing admin refund for booking:', bookingId);

      const { data, error } = await supabase.functions.invoke('admin-process-refund', {
        body: {
          booking_id: bookingId,
          refund_amount: refundAmount,
          reason,
          notify_customer: notifyCustomer
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to process refund');
      }

      if (!data.success) {
        throw new Error(data.error || 'Refund processing failed');
      }

      toast({
        title: "Refund Processed",
        description: data.message || `Successfully refunded $${data.refund_amount}`,
      });

      return {
        success: true,
        refundId: data.refund_id,
        refundAmount: data.refund_amount,
        refundType: data.refund_type,
        cancellationType: data.cancellation_type,
        message: data.message
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process refund';
      
      console.error('Admin refund error:', error);
      
      toast({
        title: "Refund Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    processRefund,
    loading
  };
};
