
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBookingCalendarSync } from '@/hooks/useBookingCalendarSync';

export const useBookingManager = (isCalendarConnected: boolean) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { syncBookingToCalendar } = useBookingCalendarSync();

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, phone, region),
          worker:users!worker_id(name, phone)
        `)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
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

  useEffect(() => {
    fetchBookings();
  }, []);

  return {
    bookings,
    loading,
    fetchBookings,
    handleBookingUpdate
  };
};
