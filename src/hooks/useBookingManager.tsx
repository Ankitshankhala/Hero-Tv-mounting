
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BookingData {
  id: string;
  customer_id?: string; // Made optional since we only handle guests
  worker_id?: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  status: string;
  location_notes?: string;
  guest_customer_info?: any;
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

  const enrichSingleBooking = async (booking: any): Promise<BookingData> => {
    // For guest-only architecture, customer data comes from guest_customer_info
    let customer = null;
    
    if (booking.guest_customer_info) {
      customer = {
        id: null, // Guest customers don't have user IDs
        name: booking.guest_customer_info.name || booking.guest_customer_info.customerName || 'Unknown',
        email: booking.guest_customer_info.email || booking.guest_customer_info.customerEmail || 'Unknown',
        phone: booking.guest_customer_info.phone || booking.guest_customer_info.customerPhone || 'Unknown',
        city: booking.guest_customer_info.city || 'Unknown'
      };
    } else if (booking.location_notes) {
      // Fallback: try to parse customer info from location_notes for legacy data
      try {
        const lines = booking.location_notes.split('\n');
        const customerInfo: any = { id: null };
        
        lines.forEach((line: string) => {
          if (line.includes('Customer:')) customerInfo.name = line.replace('Customer:', '').trim();
          if (line.includes('Contact:')) customerInfo.name = line.replace('Contact:', '').trim();
          if (line.includes('Email:')) customerInfo.email = line.replace('Email:', '').trim();
          if (line.includes('Phone:')) customerInfo.phone = line.replace('Phone:', '').trim();
          if (line.includes('City:')) customerInfo.city = line.replace('City:', '').trim();
        });
        
        if (customerInfo.name || customerInfo.email) {
          customer = customerInfo;
        }
      } catch (error) {
        console.log('Could not parse customer info from location_notes:', error);
      }
    }
    
    // If still no customer info, create a placeholder
    if (!customer) {
      customer = {
        id: null,
        name: 'Guest Customer',
        email: 'No email provided',
        phone: 'No phone provided',
        city: 'No city provided'
      };
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
    return {
      ...booking,
      customer,
      worker,
      service,
      services: service ? [service] : [],
      scheduled_at: `${booking.scheduled_date}T${booking.scheduled_start}`,
      customer_address: booking.location_notes || 'No address provided',
      total_price: service?.base_price || 0
    };
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      console.log('Fetching bookings...');

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
        bookingsData.map(enrichSingleBooking)
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

  const handleBookingUpdate = async (updatedBooking: any) => {
    console.log('Booking update received:', updatedBooking);
    
    try {
      // Enrich the updated booking with related data
      const enrichedBooking = await enrichSingleBooking(updatedBooking);
      
      setBookings(prevBookings => {
        const existingIndex = prevBookings.findIndex(booking => booking.id === updatedBooking.id);
        
        if (existingIndex >= 0) {
          // Update existing booking
          const newBookings = [...prevBookings];
          newBookings[existingIndex] = enrichedBooking;
          return newBookings;
        } else {
          // Add new booking if it doesn't exist
          return [enrichedBooking, ...prevBookings];
        }
      });

      // Show success notification for worker assignments
      if (updatedBooking.worker_id && enrichedBooking.worker?.name) {
        toast({
          title: "Worker Assigned",
          description: `${enrichedBooking.worker.name} has been assigned to booking ${updatedBooking.id.slice(0, 8)}`,
        });
      }
    } catch (error) {
      console.error('Error enriching updated booking:', error);
      // Fallback to basic update if enrichment fails
      setBookings(prevBookings => 
        prevBookings.map(booking => 
          booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking
        )
      );
    }
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
