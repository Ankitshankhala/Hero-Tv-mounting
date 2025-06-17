
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseRealtimeBookingsProps {
  userId?: string;
  userRole?: 'worker' | 'customer' | 'admin';
  onBookingUpdate?: (booking: any) => void;
}

export const useRealtimeBookings = ({ 
  userId, 
  userRole, 
  onBookingUpdate 
}: UseRealtimeBookingsProps) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId || !userRole) return;

    let channelName = '';
    let filter = '';

    // Set up different filters based on user role
    switch (userRole) {
      case 'worker':
        channelName = `worker-bookings-${userId}`;
        filter = `worker_id=eq.${userId}`;
        break;
      case 'customer':
        channelName = `customer-bookings-${userId}`;
        filter = `customer_id=eq.${userId}`;
        break;
      case 'admin':
        channelName = 'admin-all-bookings';
        filter = ''; // No filter for admin
        break;
      default:
        return;
    }

    console.log(`Setting up realtime subscription for ${userRole}:`, channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          ...(filter && { filter }),
        },
        (payload) => {
          console.log('Realtime booking update:', payload);
          
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          // Handle different event types
          if (eventType === 'UPDATE' && oldRecord && newRecord) {
            // Status change notification
            if (oldRecord.status !== newRecord.status) {
              const statusMessages = {
                confirmed: 'Your booking has been confirmed!',
                in_progress: 'Your service is now in progress',
                completed: 'Your service has been completed',
                cancelled: 'Your booking has been cancelled'
              };

              if (userRole === 'customer' && statusMessages[newRecord.status as keyof typeof statusMessages]) {
                toast({
                  title: "Booking Update",
                  description: statusMessages[newRecord.status as keyof typeof statusMessages],
                });
              }
            }

            // Worker assignment notification
            if (!oldRecord.worker_id && newRecord.worker_id && userRole === 'customer') {
              toast({
                title: "Worker Assigned",
                description: "A technician has been assigned to your booking!",
              });
            }
          }

          // Call the callback with the updated booking
          if (onBookingUpdate) {
            onBookingUpdate(newRecord || oldRecord);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          toast({
            title: "Connected",
            description: "Real-time updates enabled",
          });
        }
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [userId, userRole, onBookingUpdate, toast]);

  return { isConnected };
};
