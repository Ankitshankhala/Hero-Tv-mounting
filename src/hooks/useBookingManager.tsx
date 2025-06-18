
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BookingData {
  id: string;
  customer_id: string;
  worker_id?: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  status: string;
  location_notes?: string;
  created_at: string;
  customer?: any;
  worker?: any;
  service?: any;
  services?: any; // For backwards compatibility
  scheduled_at?: string; // For backwards compatibility
  customer_address?: string; // For backwards compatibility
  total_price?: number; // For backwards compatibility
}

export const useBookingManager = (isCalendarConnected: boolean = false) => {
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBookings = async () => {
    try {
      setLoading(true);
      console.log('Fetching bookings...');

      // First, get the basic booking data
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      console.log('Raw bookings data:', bookingsData);

      if (!bookingsData || bookingsData.length === 0) {
        console.log('No bookings found');
        setBookings([]);
        return;
      }

      // Enrich bookings with customer, worker, and service data
      const enrichedBookings = await Promise.all(
        bookingsData.map(async (booking) => {
          // Fetch customer data
          let customer = null;
          if (booking.customer_id) {
            const { data: customerData } = await supabase
              .from('users')
              .select('id, name, email, phone, city')
              .eq('id', booking.customer_id)
              .single();
            customer = customerData;
          }

          // Fetch worker data
          let worker = null;
          if (booking.worker_id) {
            const { data: workerData } = await supabase
              .from('users')
              .select('id, name, email, phone')
              .eq('id', booking.worker_id)
              .single();
            worker = workerData;
          }

          // Fetch service data
          let service = null;
          if (booking.service_id) {
            const { data: serviceData } = await supabase
              .from('services')
              .select('id, name, description, base_price, duration_minutes')
              .eq('id', booking.service_id)
              .single();
            service = serviceData;
          }

          // Create backward-compatible format
          const enrichedBooking: BookingData = {
            ...booking,
            customer,
            worker,
            service,
            services: service ? [service] : [], // For compatibility with BookingTable
            scheduled_at: `${booking.scheduled_date}T${booking.scheduled_start}`, // For compatibility
            customer_address: booking.location_notes || 'No address provided', // For compatibility
            total_price: service?.base_price || 0 // For compatibility
          };

          return enrichedBooking;
        })
      );

      console.log('Enriched bookings:', enrichedBookings);
      setBookings(enrichedBookings);
    } catch (error) {
      console.error('Error in fetchBookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookingUpdate = (updatedBooking: any) => {
    console.log('Booking update received:', updatedBooking);
    setBookings(prevBookings => 
      prevBookings.map(booking => 
        booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking
      )
    );
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  return {
    bookings,
    loading,
    handleBookingUpdate,
    fetchBookings
  };
};
