
import { useEffect, useState, useRef } from 'react';
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
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const subscriptionAttemptRef = useRef(0);

  useEffect(() => {
    if (!userId || !userRole) return;

    // Create a unique attempt ID to prevent race conditions
    const currentAttempt = ++subscriptionAttemptRef.current;

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('Connection attempt already in progress, skipping...');
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clean up existing channel before creating new one
    if (channelRef.current) {
      console.log('Cleaning up existing channel before reconnection');
      try {
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.log('Error removing channel:', error);
      }
      channelRef.current = null;
      setIsConnected(false);
    }

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
    isConnectingRef.current = true;

    const channel = supabase.channel(channelName);

    // Set up the channel configuration
    const channelConfig = {
      event: '*',
      schema: 'public',
      table: 'bookings',
      ...(filter && { filter }),
    };

    channel.on('postgres_changes', channelConfig, (payload) => {
      // Check if this is still the current attempt
      if (currentAttempt !== subscriptionAttemptRef.current) {
        console.log('Ignoring payload from old subscription attempt');
        return;
      }

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
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('Realtime subscription status:', status);
      
      // Check if this is still the current attempt
      if (currentAttempt !== subscriptionAttemptRef.current) {
        console.log('Ignoring status from old subscription attempt');
        return;
      }

      isConnectingRef.current = false;
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        channelRef.current = channel;
        console.log('Successfully connected to realtime updates');
        
        // Only show success toast for successful connections after previous failures
        if (!isConnected) {
          toast({
            title: "Connected",
            description: "Real-time updates enabled",
          });
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setIsConnected(false);
        channelRef.current = null;
        
        console.log(`Realtime connection ${status.toLowerCase()}, will retry in 5 seconds...`);
        
        // Only schedule reconnection if this is still the current attempt
        if (currentAttempt === subscriptionAttemptRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect realtime subscription...');
            // Increment attempt counter to trigger useEffect
            subscriptionAttemptRef.current++;
            setIsConnected(false);
          }, 5000);
        }
      }
    });

    return () => {
      console.log('Cleaning up realtime subscription');
      isConnectingRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.log('Error removing channel during cleanup:', error);
        }
        channelRef.current = null;
      }
      
      setIsConnected(false);
    };
  }, [userId, userRole, onBookingUpdate, toast, subscriptionAttemptRef.current]);

  return { isConnected };
};
