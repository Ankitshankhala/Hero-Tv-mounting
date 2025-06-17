
import { useState, useEffect } from 'react';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useToast } from '@/hooks/use-toast';
import { useBookingCalendarSync } from '@/hooks/useBookingCalendarSync';

export const useBookingManager = (isCalendarConnected: boolean) => {
  const [bookings, setBookings] = useState([]);
  const { toast } = useToast();
  const { syncBookingToCalendar } = useBookingCalendarSync();

  // Use the authenticated query hook
  const { 
    data: bookingsData, 
    loading, 
    error, 
    refetch: fetchBookings 
  } = useSupabaseQuery({
    table: 'bookings',
    select: `
      *,
      customer:users!customer_id(name, phone, region),
      worker:users!worker_id(name, phone)
    `,
    orderBy: { column: 'scheduled_at', ascending: false }
  });

  // Update local state when data changes
  useEffect(() => {
    if (bookingsData) {
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    }
  }, [bookingsData]);

  // Show error toast if query fails
  useEffect(() => {
    if (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleBookingUpdate = async (updatedBooking: any) => {
    console.log('Real-time booking update received:', updatedBooking);
    
    setBookings(currentBookings => {
      const existingBookingIndex = currentBookings.findIndex(booking => booking.id === updatedBooking.id);
      let updatedBookings = [...currentBookings];
      
      if (existingBookingIndex >= 0) {
        const oldBooking = currentBookings[existingBookingIndex];
        updatedBookings[existingBookingIndex] = { ...oldBooking, ...updatedBooking };
        
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
        updatedBookings.unshift(updatedBooking);
        fetchBookings();
        
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
  };

  return {
    bookings,
    loading,
    fetchBookings,
    handleBookingUpdate
  };
};
