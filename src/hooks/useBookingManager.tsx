import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateBookingTotal } from '@/utils/pricing';
import { DEFAULT_SERVICE_TIMEZONE } from '@/utils/timezoneUtils';
import { optimizedSupabaseCall, measureApiCall } from '@/utils/optimizedApi';

interface BookingData {
  id: string;
  customer_id: string;
  worker_id?: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  status: string;
  payment_status?: string;
  payment_intent_id?: string;
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
  const [enriching, setEnriching] = useState(false);
  const { toast } = useToast();

  const enrichSingleBooking = async (booking: any): Promise<BookingData> => {
    // For guest-only architecture, customer data comes from guest_customer_info
    let customer = null;
    if (booking.guest_customer_info) {
      customer = {
        id: null, // Guest customers don't have user IDs
        name: (booking.guest_customer_info as any)?.customerName || (booking.guest_customer_info as any)?.name || 'Unknown',
        email: (booking.guest_customer_info as any)?.customerEmail || (booking.guest_customer_info as any)?.email || 'Unknown',
        phone: (booking.guest_customer_info as any)?.customerPhone || (booking.guest_customer_info as any)?.phone || 'Unknown',
        city: (booking.guest_customer_info as any)?.city || 'Unknown'
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

    // Create backward-compatible format while preserving new timezone fields
    return {
      ...booking,
      customer,
      worker,
      service,
      services: service ? [service] : [],
      // Use new timezone-aware field if available, otherwise construct from legacy fields
      scheduled_at: booking.start_time_utc || `${booking.scheduled_date}T${booking.scheduled_start}`,
      customer_address: booking.location_notes || 'No address provided',
      total_price: totalPrice,
      booking_services: bookingServices,
      // Ensure service_tz is set for timezone calculations
      service_tz: booking.service_tz || DEFAULT_SERVICE_TIMEZONE
    };
  };

  const fetchBookings = async (bypassCache: boolean = false) => {
    try {
      setLoading(true);
      console.log('Fetching bookings with two-phase strategy...');

      // PHASE 1: Fast-first paint - essential fields only, limited results
      const { data: bookingsData, error: bookingsError } = await measureApiCall(
        'bookings-phase1',
        async () => {
          const result = await optimizedSupabaseCall(
            'bookings-recent-100',
            async () => {
              const response = await supabase
                .from('bookings')
                .select(`
                  id, customer_id, worker_id, service_id,
                  scheduled_date, scheduled_start, status,
                  start_time_utc, local_service_date, local_service_time, service_tz,
                  payment_status, payment_intent_id, created_at,
                  guest_customer_info, location_notes, is_archived
                `)
                .order('created_at', { ascending: false })
                .order('start_time_utc', { ascending: false, nullsFirst: false })
                .limit(100);
              return response;
            },
            !bypassCache,
            bypassCache ? 0 : 10000 // Use cache unless bypassed
          );
          return result;
        }
      );

      if (bookingsError) {
        console.error('Error fetching bookings (Phase 1):', bookingsError);
        throw bookingsError;
      }

      console.log('Phase 1 complete - basic bookings:', bookingsData?.length || 0);

      if (!bookingsData || bookingsData.length === 0) {
        console.log('No bookings found');
        setBookings([]);
        setLoading(false);
        return;
      }

      // Set minimal bookings immediately for fast render
      const minimalBookings = bookingsData.map(booking => ({
        ...booking,
        customer: booking.guest_customer_info ? {
          id: null,
          name: (booking.guest_customer_info as any)?.customerName || 'Loading...',
          email: (booking.guest_customer_info as any)?.customerEmail || '',
          phone: (booking.guest_customer_info as any)?.customerPhone || ''
        } : null,
        worker: null, // Will be enriched in Phase 2
        service: null, // Will be enriched in Phase 2
        booking_services: [], // Will be enriched in Phase 2
        total_price: 0, // Will be calculated in Phase 2
        services: [],
        scheduled_at: booking.start_time_utc || `${booking.scheduled_date}T${booking.scheduled_start}`,
        customer_address: booking.location_notes || 'Loading...',
        service_tz: booking.service_tz || DEFAULT_SERVICE_TIMEZONE
      }));

      setBookings(minimalBookings);
      setLoading(false); // Table appears immediately

      // PHASE 2: Parallel enrichment without blocking UI
      setEnriching(true);
      
      const bookingIds = bookingsData.map(b => b.id);
      const workerIds = [...new Set(bookingsData.filter(b => b.worker_id).map(b => b.worker_id))];
      const serviceIds = [...new Set(bookingsData.map(b => b.service_id))];

      console.log('Phase 2 starting - batching related data...');

      // Batch all enrichment queries in parallel
      const [
        bookingServicesResult,
        transactionsResult,
        workersResult,
        servicesResult
      ] = await Promise.allSettled([
        // Booking services
        optimizedSupabaseCall(
          `booking-services-${bookingIds.length}`,
          async () => {
            const response = await supabase
              .from('booking_services')
              .select('booking_id, service_name, quantity, base_price, configuration')
              .in('booking_id', bookingIds);
            return response;
          },
          true,
          30000
        ),
        
        // Latest transactions
        optimizedSupabaseCall(
          `transactions-${bookingIds.length}`,
          async () => {
            const response = await supabase
              .from('transactions')
              .select('booking_id, amount, status, currency, created_at')
              .in('booking_id', bookingIds)
              .in('status', ['authorized', 'completed'])
              .order('created_at', { ascending: false });
            return response;
          },
          true,
          30000
        ),

        // Workers
        workerIds.length > 0 ? optimizedSupabaseCall(
          `workers-${workerIds.length}`,
          async () => {
            const response = await supabase
              .from('users')
              .select('id, name, email, phone')
              .in('id', workerIds as string[]);
            return response;
          },
          true,
          300000 // 5min cache for worker data
        ) : Promise.resolve({ data: [], error: null }),

        // Services
        optimizedSupabaseCall(
          `services-${serviceIds.length}`,
          async () => {
            const response = await supabase
              .from('services')
              .select('id, name, description, base_price, duration_minutes')
              .in('id', serviceIds as string[]);
            return response;
          },
          true,
          300000 // 5min cache for service data
        )
      ]);

      console.log('Phase 2 batch queries complete');

      // Process results
      const bookingServicesData = bookingServicesResult.status === 'fulfilled' 
        ? (bookingServicesResult.value as any)?.data || [] 
        : [];
      const transactionsData = transactionsResult.status === 'fulfilled' 
        ? (transactionsResult.value as any)?.data || [] 
        : [];
      const workersData = workersResult.status === 'fulfilled' 
        ? (workersResult.value as any)?.data || [] 
        : [];
      const servicesData = servicesResult.status === 'fulfilled' 
        ? (servicesResult.value as any)?.data || [] 
        : [];

      if (bookingServicesResult.status === 'rejected') {
        console.error('Failed to fetch booking services:', bookingServicesResult.reason);
      }
      if (transactionsResult.status === 'rejected') {
        console.error('Failed to fetch transactions:', transactionsResult.reason);
      }
      if (workersResult.status === 'rejected') {
        console.error('Failed to fetch workers:', workersResult.reason);
      }
      if (servicesResult.status === 'rejected') {
        console.error('Failed to fetch services:', servicesResult.reason);
      }

      // Create lookup maps
      const servicesByBooking = bookingServicesData.reduce((acc, service) => {
        if (!acc[service.booking_id]) acc[service.booking_id] = [];
        acc[service.booking_id].push(service);
        return acc;
      }, {} as Record<string, any[]>);

      const txByBooking = transactionsData.reduce((acc, tx) => {
        if (!acc[tx.booking_id]) acc[tx.booking_id] = tx; // Keep latest
        return acc;
      }, {} as Record<string, any>);

      const workersById = workersData.reduce((acc, worker) => {
        acc[worker.id] = worker;
        return acc;
      }, {} as Record<string, any>);

      const servicesById = servicesData.reduce((acc, service) => {
        acc[service.id] = service;
        return acc;
      }, {} as Record<string, any>);

      // Merge enriched data
      const enrichedBookings = bookingsData.map(booking => {
        const bookingServices = servicesByBooking[booking.id] || [];
        const service = servicesById[booking.service_id];
        const worker = booking.worker_id ? workersById[booking.worker_id] : null;
        const latestTx = txByBooking[booking.id];

        // Calculate total
        let totalPrice = 0;
        if (bookingServices.length > 0) {
          totalPrice = calculateBookingTotal(bookingServices);
        } else if (service?.base_price) {
          totalPrice = Number(service.base_price) || 0;
        }

        // Enhanced customer from guest_customer_info
        const customer = booking.guest_customer_info ? {
          id: null,
          name: (booking.guest_customer_info as any)?.customerName || (booking.guest_customer_info as any)?.name || 'Unknown',
          email: (booking.guest_customer_info as any)?.customerEmail || (booking.guest_customer_info as any)?.email || 'Unknown',
          phone: (booking.guest_customer_info as any)?.customerPhone || (booking.guest_customer_info as any)?.phone || 'Unknown',
          city: (booking.guest_customer_info as any)?.city || 'Unknown'
        } : null;

        return {
          ...booking,
          customer,
          worker,
          service,
          services: service ? [service] : [],
          scheduled_at: booking.start_time_utc || `${booking.scheduled_date}T${booking.scheduled_start}`,
          customer_address: booking.location_notes || 'No address provided',
          total_price: totalPrice,
          booking_services: bookingServices,
          stripe_authorized_amount: latestTx ? Number(latestTx.amount) : undefined,
          stripe_payment_status: latestTx?.status,
          stripe_currency: latestTx?.currency || 'USD',
          stripe_tx_created_at: latestTx?.created_at,
          service_tz: booking.service_tz || DEFAULT_SERVICE_TIMEZONE
        };
      });

      console.log('Phase 2 complete - fully enriched bookings:', enrichedBookings.length);
      setBookings(enrichedBookings);
      setEnriching(false);
      
    } catch (error) {
      console.error('Error in fetchBookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive",
      });
      setLoading(false);
      setEnriching(false);
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
          // Add new booking at the top (sorted by created_at DESC)
          const newBookings = [finalEnrichedBooking, ...prevBookings];
          // Re-sort by created_at DESC to maintain proper order
          return newBookings.sort((a, b) => {
            const aTime = new Date(a.created_at).getTime();
            const bTime = new Date(b.created_at).getTime();
            return bTime - aTime;
          });
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

  const handleArchiveJob = async (jobId: string) => {
    try {
      // Update the local state immediately for better UX
      setBookings(prevBookings => 
        prevBookings.map(booking => 
          booking.id === jobId 
            ? { ...booking, is_archived: true, archived_at: new Date().toISOString() }
            : booking
        )
      );
    } catch (error) {
      console.error('Error updating archived job locally:', error);
      // If local update fails, refetch to ensure consistency
      fetchBookings();
    }
  };

  return {
    bookings,
    loading,
    enriching,
    handleBookingUpdate,
    fetchBookings,
    handleArchiveJob
  };
};
