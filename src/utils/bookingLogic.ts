
import { supabase } from '@/integrations/supabase/client';
import { validateUSZipcode, isZipcodeInServiceArea } from '@/utils/zipcodeValidation';

export interface BookingData {
  customer_id: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes?: string;
  customer_zipcode?: string; // Add zipcode for validation
}

export interface WorkerAssignment {
  worker_id: string;
  worker_name: string;
  worker_email: string;
  worker_phone: string;
  distance_priority: number;
}

export interface CreateBookingResult {
  booking_id: string;
  assigned_workers: WorkerAssignment[];
  status: 'confirmed' | 'pending' | 'error';
  message: string;
}

export const createBookingWithWorkerAssignment = async (
  bookingData: BookingData
): Promise<CreateBookingResult> => {
  try {
    // Validate zipcode if provided
    if (bookingData.customer_zipcode) {
      const zipcodeValidation = await validateUSZipcode(bookingData.customer_zipcode);
      if (!zipcodeValidation) {
        return {
          booking_id: '',
          assigned_workers: [],
          status: 'error',
          message: 'Invalid zipcode provided. Please enter a valid US zipcode.'
        };
      }
    }

    // Step 1: Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: bookingData.customer_id,
        service_id: bookingData.service_id,
        scheduled_date: bookingData.scheduled_date,
        scheduled_start: bookingData.scheduled_start,
        location_notes: bookingData.location_notes,
        status: 'pending'
      })
      .select()
      .single();

    if (bookingError) {
      throw bookingError;
    }

    // Step 2: Auto-assign workers using the database function
    const { data: assignments, error: assignmentError } = await supabase
      .rpc('auto_assign_workers_to_booking', {
        p_booking_id: booking.id
      });

    if (assignmentError) {
      console.error('Worker assignment error:', assignmentError);
      // Booking is created but assignment failed
      return {
        booking_id: booking.id,
        assigned_workers: [],
        status: 'pending',
        message: 'Booking created but no workers available in your area. Admin will assign manually.'
      };
    }

    // Step 3: Get detailed worker information for the assigned workers
    const assignedWorkerIds = assignments?.map((a: any) => a.assigned_worker_id) || [];
    
    if (assignedWorkerIds.length === 0) {
      return {
        booking_id: booking.id,
        assigned_workers: [],
        status: 'pending',
        message: 'Booking created but no workers available in your area. Admin will assign manually.'
      };
    }

    // Get worker details
    const { data: workers, error: workersError } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .in('id', assignedWorkerIds)
      .eq('role', 'worker');

    if (workersError) {
      console.error('Error fetching worker details:', workersError);
    }

    const assignedWorkers: WorkerAssignment[] = workers?.map(worker => ({
      worker_id: worker.id,
      worker_name: worker.name || 'Unknown',
      worker_email: worker.email,
      worker_phone: worker.phone || '',
      distance_priority: 1
    })) || [];

    return {
      booking_id: booking.id,
      assigned_workers: assignedWorkers,
      status: 'confirmed',
      message: `Booking confirmed! ${assignedWorkers.length} worker(s) assigned.`
    };

  } catch (error) {
    console.error('Error creating booking:', error);
    return {
      booking_id: '',
      assigned_workers: [],
      status: 'error',
      message: 'Failed to create booking. Please try again.'
    };
  }
};

export const findAvailableWorkers = async (
  zipcode: string,
  scheduledDate: string,
  scheduledStart: string,
  durationMinutes: number = 60
): Promise<WorkerAssignment[]> => {
  try {
    const { data, error } = await supabase
      .rpc('find_available_workers', {
        p_zipcode: zipcode,
        p_scheduled_date: scheduledDate,
        p_scheduled_start: scheduledStart,
        p_duration_minutes: durationMinutes
      });

    if (error) {
      console.error('Error finding available workers:', error);
      return [];
    }

    return data?.map((worker: any) => ({
      worker_id: worker.worker_id,
      worker_name: worker.worker_name,
      worker_email: worker.worker_email,
      worker_phone: worker.worker_phone,
      distance_priority: worker.distance_priority
    })) || [];

  } catch (error) {
    console.error('Error finding available workers:', error);
    return [];
  }
};

export const getWorkerBookings = async (workerId: string) => {
  try {
    const { data, error } = await supabase
      .from('worker_bookings')
      .select(`
        *,
        booking:bookings(
          *,
          customer:users!customer_id(name, email, phone),
          service:services(name, base_price, duration_minutes)
        )
      `)
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching worker bookings:', error);
    return [];
  }
};

export const updateWorkerBookingStatus = async (
  workerBookingId: string,
  status: 'assigned' | 'accepted' | 'declined' | 'completed'
) => {
  try {
    const { data, error } = await supabase
      .from('worker_bookings')
      .update({ status })
      .eq('id', workerBookingId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating worker booking status:', error);
    throw error;
  }
};
