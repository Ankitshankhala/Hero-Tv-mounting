
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Function to setup realtime subscription for worker's bookings
export const subscribeToWorkerBookings = (
  workerId: string,
  onBookingUpdate: (booking: any) => void
) => {
  const channel = supabase
    .channel('worker-bookings')
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
    supabase.removeChannel(channel);
  };
};

// Function to setup realtime subscription for customer's bookings
export const subscribeToCustomerBookings = (
  customerId: string,
  onBookingUpdate: (booking: any) => void
) => {
  const channel = supabase
    .channel('customer-bookings')
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
    supabase.removeChannel(channel);
  };
};

// Function to setup realtime subscription for admin dashboard
export const subscribeToAllBookings = (
  onBookingUpdate: (booking: any) => void
) => {
  const channel = supabase
    .channel('all-bookings')
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
    supabase.removeChannel(channel);
  };
};
