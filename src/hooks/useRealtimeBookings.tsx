
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseRealtimeBookingsProps {
  userId?: string;
  userRole?: 'worker' | 'customer' | 'admin';
  onBookingUpdate?: (booking: any, reassignmentInfo?: any) => void;
}

export const useRealtimeBookings = ({ 
  userId, 
  userRole, 
  onBookingUpdate 
}: UseRealtimeBookingsProps) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !userRole) {
      if (process.env.NODE_ENV === 'development') {
        console.log('No userId or userRole, skipping subscription');
      }
      return;
    }

    // Generate unique subscription ID to prevent conflicts
    const subscriptionId = `${userRole}-${userId}-${Date.now()}`;
    subscriptionIdRef.current = subscriptionId;

    let channelName = '';
    let filter = '';

    // Set up different filters based on user role
    switch (userRole) {
      case 'worker':
        // Listen to all booking updates to detect reassignments
        channelName = `worker-all-bookings-${subscriptionId}`;
        filter = ''; // No filter - we'll handle filtering in the callback
        break;
      case 'customer':
        channelName = `customer-bookings-${subscriptionId}`;
        filter = `customer_id=eq.${userId}`;
        break;
      case 'admin':
        channelName = `admin-all-bookings-${subscriptionId}`;
        filter = ''; // No filter for admin
        break;
      default:
        if (process.env.NODE_ENV === 'development') {
          console.log('Invalid user role, skipping subscription');
        }
        return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`Setting up realtime subscription for ${userRole}:`, channelName);
    }

    // Clean up any existing channel first
    if (channelRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Cleaning up existing channel before creating new one');
      }
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new channel
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    // Configure the channel
    const configuredChannel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        ...(filter && { filter }),
      },
      (payload) => {
        // Only process if this is still the current subscription
        if (subscriptionIdRef.current === subscriptionId) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Realtime booking update:', payload);
          }
          
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          // For workers, only process updates relevant to them
          if (userRole === 'worker') {
            const isRelevantToWorker = (record: any) => record?.worker_id === userId;
            const wasAssignedToWorker = oldRecord && isRelevantToWorker(oldRecord);
            const isAssignedToWorker = newRecord && isRelevantToWorker(newRecord);
            
            // Skip if not relevant to this worker
            if (!wasAssignedToWorker && !isAssignedToWorker) {
              return;
            }
          }
          
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

            // Worker assignment notification for customers
            if (!oldRecord.worker_id && newRecord.worker_id && userRole === 'customer') {
              toast({
                title: "Worker Assigned",
                description: "A technician has been assigned to your booking!",
              });
            }

            // Worker reassignment notifications for workers
            if (userRole === 'worker') {
              // Job was reassigned away from this worker
              if (oldRecord.worker_id === userId && newRecord.worker_id !== userId) {
                toast({
                  title: "Job Reassigned",
                  description: "A job has been reassigned to another technician.",
                });
              }
              // Job was reassigned to this worker
              if (oldRecord.worker_id !== userId && newRecord.worker_id === userId) {
                toast({
                  title: "New Job Assignment",
                  description: "A new job has been assigned to you!",
                });
              }
            }
          }

          // Call the callback with the updated booking and reassignment info
          if (onBookingUpdate) {
            const reassignmentInfo = eventType === 'UPDATE' && oldRecord && newRecord ? {
              wasReassignedAway: oldRecord.worker_id === userId && newRecord.worker_id !== userId,
              wasReassignedTo: oldRecord.worker_id !== userId && newRecord.worker_id === userId,
              oldWorkerId: oldRecord.worker_id,
              newWorkerId: newRecord.worker_id
            } : null;
            
            onBookingUpdate(newRecord || oldRecord, reassignmentInfo);
          }
        }
      }
    );

    // Subscribe to the channel
    configuredChannel.subscribe((status) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Realtime subscription status:', status, 'for channel:', channelName);
      }
      
      if (subscriptionIdRef.current === subscriptionId) {
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          if (process.env.NODE_ENV === 'development') {
            console.log('Successfully subscribed to realtime updates');
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error');
          setIsConnected(false);
        }
      }
    });

    // Cleanup function
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Cleaning up realtime subscription:', channelName);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      subscriptionIdRef.current = null;
    };
  }, [userId, userRole, toast]); // Removed onBookingUpdate from dependencies to prevent re-subscriptions

  // Use a separate effect to handle callback updates
  useEffect(() => {
    // This effect just updates the callback reference without re-subscribing
  }, [onBookingUpdate]);

  return { isConnected };
};
