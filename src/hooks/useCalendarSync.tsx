
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';

interface CalendarSyncProps {
  userId?: string;
  userRole?: 'worker' | 'customer' | 'admin';
  onBookingUpdate?: (booking: any) => void;
  onScheduleUpdate?: () => void;
}

export const useCalendarSync = ({ 
  userId, 
  userRole, 
  onBookingUpdate,
  onScheduleUpdate 
}: CalendarSyncProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Set up real-time subscriptions
  const { isConnected } = useRealtimeBookings({
    userId,
    userRole,
    onBookingUpdate: (updatedBooking) => {
      console.log('Calendar sync: booking update received', updatedBooking);
      if (onBookingUpdate) {
        onBookingUpdate(updatedBooking);
      }
      // Auto-refresh calendars after booking updates
      setTimeout(() => {
        refreshCalendars();
      }, 500);
    }
  });

  // Listen for worker schedule changes
  useEffect(() => {
    if (!userId || userRole !== 'worker') return;

    const channel = supabase
      .channel(`worker-schedule-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_schedule',
          filter: `worker_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Calendar sync: schedule update received', payload);
          if (onScheduleUpdate) {
            onScheduleUpdate();
          }
          toast({
            title: "Schedule Updated",
            description: "Your schedule has been updated",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userRole, onScheduleUpdate, toast]);

  // Listen for worker availability changes (for admin and customers)
  useEffect(() => {
    if (userRole === 'customer' || userRole === 'admin') {
      const channel = supabase
        .channel('worker-availability-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'worker_availability',
          },
          (payload) => {
            console.log('Calendar sync: worker availability changed', payload);
            refreshCalendars();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userRole]);

  const refreshCalendars = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Trigger calendar refreshes based on role
      if (onBookingUpdate) {
        // This will trigger a refresh in the consuming components
        console.log('Calendar sync: triggering calendar refresh');
      }
    } catch (error) {
      console.error('Error refreshing calendars:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onBookingUpdate]);

  const forceRefresh = useCallback(() => {
    console.log('Calendar sync: force refresh requested');
    refreshCalendars();
  }, [refreshCalendars]);

  return {
    isConnected,
    isRefreshing,
    forceRefresh,
    refreshCalendars
  };
};
