
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are available
if (!supabaseUrl) {
  console.warn('VITE_SUPABASE_URL is not set. Please configure your Supabase project.');
}

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is not set. Please configure your Supabase project.');
}

// Create a mock client if environment variables are missing
const createMockClient = () => {
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      signUp: () => Promise.resolve({ error: new Error('Supabase not configured') }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }) }),
    }),
    rpc: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    functions: {
      invoke: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
    }),
    removeChannel: () => {},
  };
};

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : createMockClient() as any;

// Function to setup realtime subscription for worker's bookings
export const subscribeToWorkerBookings = (
  workerId: string,
  onBookingUpdate: (booking: any) => void
) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase not configured - realtime subscriptions disabled');
    return () => {};
  }

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
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase not configured - realtime subscriptions disabled');
    return () => {};
  }

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
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase not configured - realtime subscriptions disabled');
    return () => {};
  }

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
