
// Re-export the properly configured Supabase client
export { supabase } from '@/integrations/supabase/client';

// Re-export the subscription functions but using the proper client
import { supabase as properSupabase } from '@/integrations/supabase/client';

// Function to setup realtime subscription for worker's bookings
export const subscribeToWorkerBookings = (
  workerId: string,
  onBookingUpdate: (booking: any) => void
) => {
  const channelName = `worker-bookings-${workerId}-${Date.now()}`;
  
  const channel = properSupabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `worker_id=eq.${workerId}`,
      },
      (payload) => {
        onBookingUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    properSupabase.removeChannel(channel);
  };
};

// Function to setup realtime subscription for customer's bookings
export const subscribeToCustomerBookings = (
  customerId: string,
  onBookingUpdate: (booking: any) => void
) => {
  const channelName = `customer-bookings-${customerId}-${Date.now()}`;
  
  const channel = properSupabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `customer_id=eq.${customerId}`,
      },
      (payload) => {
        onBookingUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    properSupabase.removeChannel(channel);
  };
};

// Function to setup realtime subscription for admin dashboard
export const subscribeToAllBookings = (
  onBookingUpdate: (booking: any) => void
) => {
  const channelName = `all-bookings-${Date.now()}`;
  
  const channel = properSupabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
      },
      (payload) => {
        onBookingUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    properSupabase.removeChannel(channel);
  };
};
