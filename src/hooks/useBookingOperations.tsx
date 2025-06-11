
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';
import { useRetryableQuery } from './useRetryableQuery';

export const useBookingOperations = () => {
  const { executeWithRetry } = useRetryableQuery();
  const { handleError } = useErrorHandler();
  const [loading, setLoading] = useState(false);

  const createBooking = async (bookingData: any) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('bookings')
          .insert(bookingData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }, 'create booking');
    } catch (error) {
      handleError(error, 'create booking', {
        toastTitle: 'Failed to create booking',
        fallbackMessage: 'Unable to create booking. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('bookings')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', bookingId)
          .select()
          .single();

        if (error) throw error;
        return data;
      }, 'update job status');
    } catch (error) {
      handleError(error, 'update job status', {
        toastTitle: 'Failed to update job status',
        fallbackMessage: 'Unable to update job status. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async (filters?: any) => {
    try {
      return await executeWithRetry(async () => {
        let query = supabase
          .from('bookings')
          .select(`
            *,
            customer:users!customer_id(*),
            worker:users!worker_id(*)
          `);

        // Apply filters if provided
        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      }, 'load bookings');
    } catch (error) {
      handleError(error, 'load bookings', {
        toastTitle: 'Failed to load bookings',
        fallbackMessage: 'Unable to load bookings. Please refresh the page.'
      });
      return [];
    }
  };

  return {
    createBooking,
    updateBookingStatus,
    loadBookings,
    loading
  };
};
