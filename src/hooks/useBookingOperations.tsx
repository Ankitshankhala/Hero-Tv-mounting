
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';
import { useRetryableQuery } from './useRetryableQuery';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export const useBookingOperations = () => {
  const { executeWithRetry } = useRetryableQuery();
  const { handleError } = useErrorHandler();
  const [loading, setLoading] = useState(false);

  const createBooking = async (bookingData: any) => {
    setLoading(true);
    try {
      console.log('Creating booking with data:', bookingData);
      
      return await executeWithRetry(async () => {
        // Ensure we have the required fields
        const bookingPayload = {
          customer_id: bookingData.customer_id,
          service_id: bookingData.service_id,
          scheduled_date: bookingData.scheduled_date,
          scheduled_start: bookingData.scheduled_start,
          location_notes: bookingData.location_notes || '',
          status: bookingData.status || 'pending',
          payment_status: bookingData.payment_status || 'pending',
          requires_manual_payment: bookingData.requires_manual_payment !== false,
          worker_id: bookingData.worker_id || null
        };

        console.log('Booking payload:', bookingPayload);

        const { data, error } = await supabase
          .from('bookings')
          .insert(bookingPayload)
          .select(`
            *,
            customer:users!customer_id(*),
            worker:users!worker_id(*),
            service:services(*)
          `)
          .single();

        if (error) {
          console.error('Booking creation error:', error);
          throw error;
        }

        console.log('Booking created successfully:', data);
        return data;
      }, 'create booking');
    } catch (error) {
      console.error('Error in createBooking:', error);
      handleError(error, 'create booking', {
        toastTitle: 'Failed to create booking',
        fallbackMessage: 'Unable to create booking. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('bookings')
          .update({ status })
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
            worker:users!worker_id(*),
            service:services(*)
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
