
import { useState, useEffect } from 'react';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useBookingOperations } from '@/hooks/useBookingOperations';
import { useToast } from '@/hooks/use-toast';
import { useBookingCalendarSync } from '@/hooks/useBookingCalendarSync';

export const useBookingManager = (isCalendarConnected: boolean) => {
  const [bookings, setBookings] = useState([]);
  const { toast } = useToast();
  const { syncBookingToCalendar } = useBookingCalendarSync();
  const { loadBookings } = useBookingOperations();

  // Use the authenticated query hook for initial load
  const { 
    data: bookingsData, 
    loading, 
    error, 
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

  // Custom fetch function with better error handling
  const fetchBookings = async () => {
    try {
      console.log('Fetching bookings manually...');
      const data = await loadBookings();
      if (data) {
        setBookings(Array.isArray(data) ? data : []);
        console.log('Manual booking fetch successful:', data.length, 'bookings');
      }
    } catch (error) {
      console.error('Manual booking fetch failed:', error);
      toast({
        title: "Error",
        description: "Failed to refresh bookings",
        variant: "destructive",
      });
    }
  };

  // Update local state when data changes
  useEffect(() => {
    if (bookingsData) {
      const bookingsList = Array.isArray(bookingsData) ? bookingsData : [];
      setBookings(bookingsList);
      console.log('Bookings data updated from query:', bookingsList.length, 'bookings');
    }
  }, [bookingsData]);

  // Show error toast if query fails
  useEffect(() => {
    if (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings. Click refresh to try again.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Force refresh bookings every 30 seconds to ensure data consistency
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing bookings...');
      refetchBookings();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchBookings]);

  const handleBookingUpdate = async (updatedBooking: any) => {
    console.log('Real-time booking update received:', updatedBooking);
    
    setBookings(currentBookings => {
      const existingBookingIndex = currentBookings.findIndex(booking => booking.id === updatedBooking.id);
      let updatedBookings = [...currentBookings];
      
      if (existingBookingIndex >= 0) {
        // Update existing booking
        const oldBooking = currentBookings[existingBookingIndex];
        updatedBookings[existingBookingIndex] = { ...oldBooking, ...updatedBooking };
        console.log('Updated existing booking in list');
        
        // Handle calendar sync for real-time updates if calendar is connected
        if (isCalendarConnected) {
          const bookingData = updatedBookings[existingBookingIndex];
          
          // Determine if this is a status change that needs calendar sync
          if (oldBooking.status !== updatedBooking.status) {
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
                console.error('Error syncing calendar for real-time update:', error);
              }
            }, 0);
          }
        }
      } else {
        // Add new booking to the beginning of the list
        updatedBookings.unshift(updatedBooking);
        console.log('Added new booking to list');
        
        // Force a refetch to get complete booking data
        setTimeout(() => {
          fetchBookings();
        }, 1000);
        
        // Handle calendar sync for new bookings
        if (isCalendarConnected && updatedBooking.status !== 'cancelled') {
          setTimeout(async () => {
            try {
              await syncBookingToCalendar(updatedBooking, 'create');
            } catch (error) {
              console.error('Error syncing new booking to calendar:', error);
            }
          }, 0);
        }
      }
      
      return updatedBookings;
    });
    
    // Show toast for new bookings
    if (!bookings.find(b => b.id === updatedBooking.id)) {
      toast({
        title: "New Booking",
        description: "A new booking has been received!",
      });
    }
  };

  return {
    bookings,
    loading,
    fetchBookings,
    handleBookingUpdate,
    refetchBookings
  };
};
