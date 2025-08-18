
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateBookingTotal } from '@/utils/pricing';

interface BookingData {
  id: string;
  customer_id: string;
  worker_id?: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  status: string;
  is_archived?: boolean;
  archived_at?: string;
  location_notes?: string;
  created_at: string;
  customer?: any;
  worker?: any;
  service?: any;
  services?: any; // For backwards compatibility
  scheduled_at?: string; // For backwards compatibility
  customer_address?: string; // For backwards compatibility
  total_price?: number; // For backwards compatibility
  booking_services?: any[]; // Service line items
  // Stripe transaction snapshot
  stripe_authorized_amount?: number;
  stripe_payment_status?: string;
  stripe_currency?: string;
  stripe_tx_created_at?: string;
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
        name: booking.guest_customer_info.customerName || booking.guest_customer_info.name || 'Unknown',
        email: booking.guest_customer_info.customerEmail || booking.guest_customer_info.email || 'Unknown',
        phone: booking.guest_customer_info.customerPhone || booking.guest_customer_info.phone || 'Unknown',
        city: booking.guest_customer_info.city || 'Unknown'
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

    // Fetch booking services to calculate accurate total
    const { data: bookingServicesData } = await supabase
      .from('booking_services')
      .select('service_name, quantity, base_price, configuration')
      .eq('booking_id', booking.id);

    const bookingServices = bookingServicesData || [];
    
    // Calculate total price including main service + add-ons
    let totalPrice = 0;
    if (bookingServices.length > 0) {
      // Use booking services if they exist
      totalPrice = calculateBookingTotal(bookingServices);
      console.log('Booking', booking.id.slice(0, 8), 'services:', bookingServices, 'total:', totalPrice);
    } else if (service?.base_price) {
      // Fallback to main service price
      totalPrice = Number(service.base_price) || 0;
      console.log('Booking', booking.id.slice(0, 8), 'fallback price:', totalPrice);
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
      total_price: totalPrice,
      booking_services: bookingServices
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

      // Fetch booking services for all bookings
      let servicesByBooking = {};
      if (bookingsData.length > 0) {
        const bookingIds = bookingsData.map(booking => booking.id);
        const { data: bookingServicesData, error: servicesError } = await supabase
          .from('booking_services')
          .select('booking_id, service_name, quantity, base_price, configuration')
          .in('booking_id', bookingIds);

        if (servicesError) {
          console.error('Error fetching booking services:', servicesError);
        } else {
          servicesByBooking = (bookingServicesData || []).reduce((acc, service) => {
            if (!acc[service.booking_id]) {
              acc[service.booking_id] = [];
            }
            acc[service.booking_id].push(service);
            return acc;
          }, {} as Record<string, any[]>);
        }
      }
      // Fetch latest Stripe transactions (authorized or completed) for all bookings
      let txByBooking: Record<string, any> = {};
      if (bookingsData.length > 0) {
        const bookingIds = bookingsData.map(b => b.id);
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('booking_id, amount, status, currency, created_at')
          .in('booking_id', bookingIds)
          .in('status', ['authorized','completed'])
          .order('created_at', { ascending: false });

        if (txError) {
          console.error('Error fetching transactions:', txError);
        } else {
          (txData || []).forEach((tx: any) => {
            if (!txByBooking[tx.booking_id]) {
              txByBooking[tx.booking_id] = tx;
            }
          });
        }
      }

      // Enrich bookings with customer, worker, service data, services, and Stripe snapshot
      const enrichedBookings = await Promise.all(
        bookingsData.map(async (booking) => {
          const enriched = await enrichSingleBooking(booking);
          const bookingServices = servicesByBooking[booking.id] || [];
          
          // Calculate total authorized amount from booking services or fallback
          let computedTotalAuthorized = 0;
          if (bookingServices.length > 0) {
            computedTotalAuthorized = calculateBookingTotal(bookingServices);
          } else if (enriched.service?.base_price) {
            computedTotalAuthorized = enriched.service.base_price;
          }

          const latestTx = txByBooking[booking.id];

          return {
            ...enriched,
            booking_services: bookingServices,
            total_price: computedTotalAuthorized,
            stripe_authorized_amount: latestTx ? Number(latestTx.amount) : undefined,
            stripe_payment_status: latestTx?.status,
            stripe_currency: latestTx?.currency || 'USD',
            stripe_tx_created_at: latestTx?.created_at
          };
        })
      );

      console.log('Enriched bookings with services and Stripe snapshot:', enrichedBookings);
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
      
      // Fetch booking services for the updated booking
      const { data: bookingServicesData, error: servicesError } = await supabase
        .from('booking_services')
        .select('booking_id, service_name, quantity, base_price, configuration')
        .eq('booking_id', updatedBooking.id);

      const bookingServices = servicesError ? [] : (bookingServicesData || []);
      
      // Calculate total authorized amount
      let computedTotalAuthorized = 0;
      if (bookingServices.length > 0) {
        computedTotalAuthorized = calculateBookingTotal(bookingServices);
      } else if (enrichedBooking.service?.base_price) {
        computedTotalAuthorized = enrichedBooking.service.base_price;
      }
      
      // Fetch latest Stripe transaction for this booking
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('booking_id, amount, status, currency, created_at')
        .eq('booking_id', updatedBooking.id)
        .in('status', ['authorized','completed'])
        .order('created_at', { ascending: false })
        .limit(1);

      const latestTx = txError ? null : ((txData && txData[0]) || null);

      const finalEnrichedBooking = {
        ...enrichedBooking,
        booking_services: bookingServices,
        total_price: computedTotalAuthorized,
        stripe_authorized_amount: latestTx ? Number(latestTx.amount) : enrichedBooking.stripe_authorized_amount,
        stripe_payment_status: latestTx?.status || enrichedBooking.stripe_payment_status,
        stripe_currency: latestTx?.currency || enrichedBooking.stripe_currency || 'USD',
        stripe_tx_created_at: latestTx?.created_at || enrichedBooking.stripe_tx_created_at
      };
      
      setBookings(prevBookings => {
        const existingIndex = prevBookings.findIndex(booking => booking.id === updatedBooking.id);
        
        if (existingIndex >= 0) {
          // Update existing booking
          const newBookings = [...prevBookings];
          newBookings[existingIndex] = finalEnrichedBooking;
          return newBookings;
        } else {
          // Add new booking if it doesn't exist
          return [finalEnrichedBooking, ...prevBookings];
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

  // Realtime subscription to Stripe transactions to keep amounts fresh
  useEffect(() => {
    const channel = supabase
      .channel('transactions-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        const tx: any = (payload as any).new;
        if (!tx?.booking_id) return;
        if (['authorized','completed'].includes(tx.status)) {
          setBookings(prev => prev.map(b => {
            if (b.id !== tx.booking_id) return b;
            const prevTs = b.stripe_tx_created_at ? new Date(b.stripe_tx_created_at).getTime() : 0;
            const newTs = tx.created_at ? new Date(tx.created_at).getTime() : Date.now();
            if (newTs < prevTs) return b;
            return {
              ...b,
              stripe_authorized_amount: Number(tx.amount) || b.stripe_authorized_amount,
              stripe_payment_status: tx.status,
              stripe_currency: tx.currency || b.stripe_currency || 'USD',
              stripe_tx_created_at: tx.created_at || new Date().toISOString(),
            };
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    bookings,
    loading,
    handleBookingUpdate,
    fetchBookings
  };
};
