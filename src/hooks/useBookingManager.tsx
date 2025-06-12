
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useBookingOperations } from '@/hooks/useBookingOperations';
import { useToast } from '@/hooks/use-toast';
import { useBookingCalendarSync } from '@/hooks/useBookingCalendarSync';

interface BookingManagerOptions {
  enableAutoRefresh?: boolean;
  refreshInterval?: number;
  enableCalendarSync?: boolean;
  enableToastNotifications?: boolean;
}

export const useBookingManager = (
  isCalendarConnected: boolean, 
  options: BookingManagerOptions = {}
) => {
  const {
    enableAutoRefresh = true,
    refreshInterval = 30000,
    enableCalendarSync = true,
    enableToastNotifications = true
  } = options;

  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { syncBookingToCalendar } = useBookingCalendarSync();
  const { loadBookings } = useBookingOperations();
  
  // Use refs to avoid circular dependencies and maintain stable references
  const bookingsRef = useRef([]);
  const isProcessingUpdate = useRef(false);
  const lastUpdateTimestamp = useRef(Date.now());

  // Use the authenticated query hook for initial load
  const { 
    data: bookingsData, 
    loading, 
    error: queryError, 
    refetch: refetchBookings 
  } = useSupabaseQuery({
    table: 'bookings',
    select: `
      *,
      customer:users!customer_id(name, phone, region),
      worker:users!worker_id(name, phone)
    `,
    orderBy: { column: 'created_at', ascending: false }
  });

  // Enhanced fetch function with error handling and retry logic
  const fetchBookings = useCallback(async (retryCount = 0) => {
    if (isProcessingUpdate.current) {
      console.log('Update already in progress, skipping fetch');
      return;
    }

    try {
      console.log('Fetching bookings manually...');
      isProcessingUpdate.current = true;
      setError(null);
      
      const data = await loadBookings();
      if (data) {
        setBookings(Array.isArray(data) ? data : []);
        bookingsRef.current = Array.isArray(data) ? data : [];
        lastUpdateTimestamp.current = Date.now();
        console.log('Manual booking fetch successful:', data.length, 'bookings');
      }
    } catch (err) {
      console.error('Manual booking fetch failed:', err);
      const errorMessage = err && typeof err === 'object' && 'message' in err 
        ? (err as Error).message 
        : 'Failed to fetch bookings';
      setError(errorMessage);
      
      // Retry logic for production resilience
      if (retryCount < 2) {
        console.log(`Retrying fetch (attempt ${retryCount + 1}/3)`);
        setTimeout(() => fetchBookings(retryCount + 1), 2000 * (retryCount + 1));
        return;
      }
      
      if (enableToastNotifications) {
        toast({
          title: "Error",
          description: "Failed to refresh bookings. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      isProcessingUpdate.current = false;
    }
  }, [loadBookings, toast, enableToastNotifications]);

  // Update local state when data changes
  useEffect(() => {
    if (bookingsData) {
      const bookingsList = Array.isArray(bookingsData) ? bookingsData : [];
      setBookings(bookingsList);
      bookingsRef.current = bookingsList;
      lastUpdateTimestamp.current = Date.now();
      setError(null);
      console.log('Bookings data updated from query:', bookingsList.length, 'bookings');
    }
  }, [bookingsData]);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      console.error('Query error:', queryError);
      const errorMessage = queryError && typeof queryError === 'object' && 'message' in queryError 
        ? (queryError as Error).message 
        : 'Failed to load bookings';
      setError(errorMessage);
      
      if (enableToastNotifications) {
        toast({
          title: "Error",
          description: "Failed to load bookings. Click refresh to try again.",
          variant: "destructive",
        });
      }
    }
  }, [queryError, toast, enableToastNotifications]);

  // Auto-refresh with configurable interval
  useEffect(() => {
    if (!enableAutoRefresh) return;

    const interval = setInterval(() => {
      console.log('Auto-refreshing bookings...');
      refetchBookings();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refetchBookings, enableAutoRefresh, refreshInterval]);

  // Enhanced booking update handler with optimistic updates and error recovery
  const handleBookingUpdate = useCallback(async (updatedBooking: any) => {
    if (!updatedBooking?.id) {
      console.warn('Invalid booking update received:', updatedBooking);
      return;
    }

    console.log('Real-time booking update received:', updatedBooking);
    
    // Prevent duplicate processing
    if (isProcessingUpdate.current) {
      console.log('Update already in progress, queuing...');
      setTimeout(() => handleBookingUpdate(updatedBooking), 100);
      return;
    }

    try {
      isProcessingUpdate.current = true;
      
      setBookings(currentBookings => {
        const existingBookingIndex = currentBookings.findIndex(booking => booking.id === updatedBooking.id);
        let updatedBookings = [...currentBookings];
        
        if (existingBookingIndex >= 0) {
          // Update existing booking with merge strategy
          const oldBooking = currentBookings[existingBookingIndex];
          updatedBookings[existingBookingIndex] = { 
            ...oldBooking, 
            ...updatedBooking,
            updated_at: updatedBooking.updated_at || new Date().toISOString()
          };
          console.log('Updated existing booking in list');
          
          // Handle calendar sync for real-time updates
          if (enableCalendarSync && isCalendarConnected) {
            const bookingData = updatedBookings[existingBookingIndex];
            
            if (oldBooking.status !== updatedBooking.status) {
              // Async calendar sync without blocking UI
              setTimeout(async () => {
                try {
                  if (updatedBooking.status === 'cancelled') {
                    await syncBookingToCalendar(bookingData, 'delete');
                  } else if (oldBooking.status === 'pending' && updatedBooking.status === 'confirmed') {
                    await syncBookingToCalendar(bookingData, 'create');
                  } else {
                    await syncBookingToCalendar(bookingData, 'update');
                  }
                } catch (error) {
                  console.error('Calendar sync error for real-time update:', error);
                }
              }, 0);
            }
          }
        } else {
          // Add new booking with proper positioning
          const newBooking = {
            ...updatedBooking,
            created_at: updatedBooking.created_at || new Date().toISOString()
          };
          updatedBookings.unshift(newBooking);
          console.log('Added new booking to list');
          
          // Force refresh for complete data after short delay
          setTimeout(() => {
            fetchBookings();
          }, 1000);
          
          // Handle calendar sync for new bookings
          if (enableCalendarSync && isCalendarConnected && updatedBooking.status !== 'cancelled') {
            setTimeout(async () => {
              try {
                await syncBookingToCalendar(updatedBooking, 'create');
              } catch (error) {
                console.error('Calendar sync error for new booking:', error);
              }
            }, 0);
          }
          
          // Show notification for new bookings
          if (enableToastNotifications && !bookingsRef.current.find(b => b.id === updatedBooking.id)) {
            toast({
              title: "New Booking",
              description: "A new booking has been received!",
            });
          }
        }
        
        // Update refs
        bookingsRef.current = updatedBookings;
        lastUpdateTimestamp.current = Date.now();
        return updatedBookings;
      });
    } catch (err) {
      console.error('Error processing booking update:', err);
      setError('Failed to process booking update');
    } finally {
      isProcessingUpdate.current = false;
    }
  }, [isCalendarConnected, syncBookingToCalendar, fetchBookings, toast, enableCalendarSync, enableToastNotifications]);

  // Production monitoring and health check
  const getHealthStatus = useCallback(() => {
    return {
      bookingsCount: bookings.length,
      lastUpdate: lastUpdateTimestamp.current,
      isLoading: loading,
      hasError: !!error,
      errorMessage: error,
      isConnected: !queryError
    };
  }, [bookings.length, loading, error, queryError]);

  return {
    bookings,
    loading,
    error,
    fetchBookings,
    handleBookingUpdate,
    refetchBookings,
    getHealthStatus
  };
};
