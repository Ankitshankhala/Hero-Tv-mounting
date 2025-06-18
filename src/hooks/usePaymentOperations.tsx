
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';
import { useRetryableQuery } from './useRetryableQuery';

export const usePaymentOperations = () => {
  const { executeWithRetry } = useRetryableQuery();
  const { handleError } = useErrorHandler();
  const [loading, setLoading] = useState(false);

  const processPayment = async (paymentData: any) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        // Call the Supabase edge function for payment processing
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: paymentData
        });

        if (error) throw error;
        return data;
      }, 'process payment');
    } catch (error) {
      handleError(error, 'process payment', {
        toastTitle: 'Failed to process payment',
        fallbackMessage: 'Payment processing failed. Please try again or contact support.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createPaymentRecord = async (paymentData: any) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('transactions')
          .insert(paymentData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }, 'create payment record');
    } catch (error) {
      handleError(error, 'create payment record', {
        toastTitle: 'Failed to create payment record',
        fallbackMessage: 'Unable to create payment record. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    processPayment,
    createPaymentRecord,
    loading
  };
};
