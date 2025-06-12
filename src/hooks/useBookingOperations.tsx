
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';
import { useRetryableQuery } from './useRetryableQuery';

type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export const useBookingOperations = () => {
  const { executeWithRetry } = useRetryableQuery();
  const { handleError } = useErrorHandler();
  const [loading, setLoading] = useState(false);

  const createBooking = async (bookingData: any) => {
    setLoading(true);
    try {
      console.log('Creating booking with data:', bookingData);
      
      return await executeWithRetry(async () => {
        // First, let's check if we have available workers in the region
        const { data: availableWorkers, error: workersError } = await supabase
          .from('users')
          .select('id, name, region')
          .eq('role', 'worker')
          .eq('is_active', true)
          .eq('region', bookingData.customer_region || bookingData.region);

        if (workersError) {
          console.error('Error fetching available workers:', workersError);
        } else {
          console.log('Available workers in region:', availableWorkers);
        }

        // Create the booking
        const { data, error } = await supabase
          .from('bookings')
          .insert({
            customer_id: bookingData.customer_id,
            scheduled_at: bookingData.scheduled_at,
            services: bookingData.services,
            total_price: bookingData.total_price,
            total_duration_minutes: bookingData.total_duration_minutes,
            customer_address: bookingData.customer_address,
            special_instructions: bookingData.special_instructions,
            status: 'pending'
          })
          .select(`
            *,
            customer:users!customer_id(name, phone, region),
            worker:users!worker_id(name, phone)
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
      console.error('Create booking failed:', error);
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
      console.log(`Updating booking ${bookingId} status to ${status}`);
      
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('bookings')
          .update({ 
            status, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', bookingId)
          .select(`
            *,
            customer:users!customer_id(name, phone, region),
            worker:users!worker_id(name, phone)
          `)
          .single();

        if (error) {
          console.error('Booking status update error:', error);
          throw error;
        }
        
        console.log('Booking status updated successfully:', data);
        return data;
      }, 'update job status');
    } catch (error) {
      console.error('Update booking status failed:', error);
      handleError(error, 'update job status', {
        toastTitle: 'Failed to update job status',
        fallbackMessage: 'Unable to update job status. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const assignWorkerToBooking = async (bookingId: string, workerId: string) => {
    setLoading(true);
    try {
      console.log(`Assigning worker ${workerId} to booking ${bookingId}`);
      
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('bookings')
          .update({ 
            worker_id: workerId,
            status: 'confirmed',
            updated_at: new Date().toISOString() 
          })
          .eq('id', bookingId)
          .select(`
            *,
            customer:users!customer_id(name, phone, region),
            worker:users!worker_id(name, phone)
          `)
          .single();

        if (error) {
          console.error('Worker assignment error:', error);
          throw error;
        }
        
        console.log('Worker assigned successfully:', data);
        return data;
      }, 'assign worker');
    } catch (error) {
      console.error('Assign worker failed:', error);
      handleError(error, 'assign worker', {
        toastTitle: 'Failed to assign worker',
        fallbackMessage: 'Unable to assign worker. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async (filters?: any) => {
    try {
      console.log('Loading bookings with filters:', filters);
      
      return await executeWithRetry(async () => {
        let query = supabase
          .from('bookings')
          .select(`
            *,
            customer:users!customer_id(name, phone, region),
            worker:users!worker_id(name, phone)
          `);

        // Apply filters if provided
        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        if (filters?.region && filters.region !== 'all') {
          query = query.eq('customer.region', filters.region);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('Load bookings error:', error);
          throw error;
        }
        
        console.log('Bookings loaded successfully:', data?.length || 0, 'bookings');
        return data || [];
      }, 'load bookings');
    } catch (error) {
      console.error('Load bookings failed:', error);
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
    assignWorkerToBooking,
    loadBookings,
    loading
  };
};
