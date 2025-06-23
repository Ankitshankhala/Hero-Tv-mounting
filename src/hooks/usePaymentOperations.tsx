
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';
import { useRetryableQuery } from './useRetryableQuery';
import { useErrorMonitoring } from './useErrorMonitoring';

export const usePaymentOperations = () => {
  const { executeWithRetry } = useRetryableQuery();
  const { handleError } = useErrorHandler();
  const { logPaymentError, logStripeError, logSupabaseError } = useErrorMonitoring();
  const [loading, setLoading] = useState(false);

  const processPayment = async (paymentData: any) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        // Log payment attempt
        console.log('Processing payment:', { 
          bookingId: paymentData.bookingId, 
          amount: paymentData.amount 
        });

        // Call the Supabase edge function for payment processing
        const { data, error } = await supabase.functions.invoke('process-payment', {
          body: paymentData
        });

        if (error) {
          logSupabaseError(error, 'process-payment function call', {
            paymentData: {
              bookingId: paymentData.bookingId,
              amount: paymentData.amount
            }
          });
          throw error;
        }

        if (!data?.success) {
          const paymentError = new Error(data?.error || 'Payment processing failed');
          logPaymentError(paymentError, 'payment processing', {
            response: data,
            paymentData
          });
          throw paymentError;
        }

        console.log('Payment processed successfully:', data);
        return data;
      }, 'process payment');
    } catch (error) {
      handleError(error, 'process payment', {
        toastTitle: 'Failed to process payment',
        fallbackMessage: 'Payment processing failed. Please try again or contact support.',
        category: 'payment',
        metadata: {
          bookingId: paymentData.bookingId,
          amount: paymentData.amount
        }
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
        console.log('Creating payment record:', paymentData);

        const { data, error } = await supabase
          .from('transactions')
          .insert(paymentData)
          .select()
          .single();

        if (error) {
          logSupabaseError(error, 'create transaction record', {
            paymentData
          });
          throw error;
        }

        console.log('Payment record created successfully:', data);
        return data;
      }, 'create payment record');
    } catch (error) {
      handleError(error, 'create payment record', {
        toastTitle: 'Failed to create payment record',
        fallbackMessage: 'Unable to create payment record. Please try again.',
        category: 'database',
        metadata: paymentData
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
