
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

  const createInvoiceModification = async (modificationData: any) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('invoice_modifications')
          .insert(modificationData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }, 'create invoice modification');
    } catch (error) {
      handleError(error, 'create invoice modification', {
        toastTitle: 'Failed to create invoice modification',
        fallbackMessage: 'Unable to create invoice modification. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    processPayment,
    createInvoiceModification,
    loading
  };
};
