
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  createBookingWithWorkerAssignment, 
  findAvailableWorkers,
  getWorkerBookings,
  updateWorkerBookingStatus,
  type BookingData,
  type CreateBookingResult,
  type WorkerAssignment
} from '@/utils/bookingLogic';

export const useBookingLogic = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createBooking = async (bookingData: BookingData): Promise<CreateBookingResult> => {
    setLoading(true);
    try {
      const result = await createBookingWithWorkerAssignment(bookingData);
      
      if (result.status === 'confirmed') {
        toast({
          title: "Booking Confirmed",
          description: result.message,
        });
      } else if (result.status === 'pending') {
        toast({
          title: "Booking Pending",
          description: result.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Booking Failed",
          description: result.message,
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in createBooking:', error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
      return {
        booking_id: '',
        assigned_workers: [],
        status: 'error',
        message: 'Failed to create booking'
      };
    } finally {
      setLoading(false);
    }
  };

  const checkAvailableWorkers = async (
    zipcode: string,
    scheduledDate: string,
    scheduledStart: string,
    durationMinutes?: number
  ): Promise<WorkerAssignment[]> => {
    setLoading(true);
    try {
      const workers = await findAvailableWorkers(zipcode, scheduledDate, scheduledStart, durationMinutes);
      return workers;
    } catch (error) {
      console.error('Error checking available workers:', error);
      toast({
        title: "Error",
        description: "Failed to check worker availability.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkerBookings = async (workerId: string) => {
    setLoading(true);
    try {
      const bookings = await getWorkerBookings(workerId);
      return bookings;
    } catch (error) {
      console.error('Error fetching worker bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load worker bookings.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (
    workerBookingId: string,
    status: 'assigned' | 'accepted' | 'declined' | 'completed'
  ) => {
    setLoading(true);
    try {
      const result = await updateWorkerBookingStatus(workerBookingId, status);
      toast({
        title: "Status Updated",
        description: `Booking status updated to ${status}`,
      });
      return result;
    } catch (error) {
      console.error('Error updating booking status:', error);
      toast({
        title: "Error",
        description: "Failed to update booking status.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    createBooking,
    checkAvailableWorkers,
    fetchWorkerBookings,
    updateBookingStatus,
    loading
  };
};
