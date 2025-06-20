
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validateUSZipcode } from '@/utils/zipcodeValidation';

export interface UnauthenticatedBookingData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_zipcode: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes?: string;
  total_price: number;
  duration_minutes: number;
}

export interface CreateBookingResult {
  booking_id: string;
  assigned_workers: any[];
  status: 'confirmed' | 'pending' | 'error';
  message: string;
}

export const useBookingLogic = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createBooking = async (bookingData: UnauthenticatedBookingData): Promise<CreateBookingResult> => {
    setLoading(true);
    try {
      // Validate zipcode first
      const zipcodeValidation = await validateUSZipcode(bookingData.customer_zipcode);
      if (!zipcodeValidation) {
        return {
          booking_id: '',
          assigned_workers: [],
          status: 'error',
          message: 'Invalid zipcode. Please enter a valid US zipcode.'
        };
      }

      // Create or find customer
      let customerId: string;

      // Check if customer already exists
      const { data: existingCustomer } = await supabase
        .from('users')
        .select('id')
        .eq('email', bookingData.customer_email)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('users')
          .insert({
            name: bookingData.customer_name,
            email: bookingData.customer_email,
            phone: bookingData.customer_phone,
            zip_code: bookingData.customer_zipcode,
            city: zipcodeValidation.city,
            role: 'customer'
          })
          .select('id')
          .single();

        if (customerError) {
          console.error('Customer creation error:', customerError);
          return {
            booking_id: '',
            assigned_workers: [],
            status: 'error',
            message: 'Failed to create customer profile. Please try again.'
          };
        }

        customerId = newCustomer.id;
      }

      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: customerId,
          service_id: bookingData.service_id,
          scheduled_date: bookingData.scheduled_date,
          scheduled_start: bookingData.scheduled_start,
          location_notes: bookingData.location_notes,
          status: 'pending'
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
        return {
          booking_id: '',
          assigned_workers: [],
          status: 'error',
          message: 'Failed to create booking. Please try again.'
        };
      }

      // Auto-assign workers using the database function
      const { data: assignments, error: assignmentError } = await supabase
        .rpc('auto_assign_workers_to_booking', {
          p_booking_id: booking.id
        });

      if (assignmentError) {
        console.error('Worker assignment error:', assignmentError);
        return {
          booking_id: booking.id,
          assigned_workers: [],
          status: 'pending',
          message: 'Booking created! No workers currently available in your area, but we will assign one soon and contact you.'
        };
      }

      // Get assigned worker details if any
      const assignedWorkerIds = assignments?.map((a: any) => a.assigned_worker_id) || [];
      
      if (assignedWorkerIds.length === 0) {
        return {
          booking_id: booking.id,
          assigned_workers: [],
          status: 'pending',
          message: 'Booking created! No workers currently available in your area, but we will assign one soon and contact you.'
        };
      }

      return {
        booking_id: booking.id,
        assigned_workers: assignedWorkerIds,
        status: 'confirmed',
        message: `Booking confirmed! We've assigned ${assignedWorkerIds.length} worker(s) to your job and will contact you soon.`
      };

    } catch (error) {
      console.error('Error in createBooking:', error);
      return {
        booking_id: '',
        assigned_workers: [],
        status: 'error',
        message: 'Failed to create booking. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    createBooking,
    loading
  };
};
