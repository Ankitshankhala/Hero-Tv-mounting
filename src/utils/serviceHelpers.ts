
import { supabase } from '@/integrations/supabase/client';

// Fetch all active services
export const fetchServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('base_price', { ascending: true });
  
  if (error) throw error;
  return data;
};

// Calculate total price and duration for selected services (simplified version)
export const calculateBookingTotals = async (serviceSelections: { id: string, quantity: number }[]) => {
  // For now, we'll calculate this on the client side since the function doesn't exist yet
  let totalPrice = 0;
  let totalDuration = 0;
  
  for (const selection of serviceSelections) {
    const { data: service, error } = await supabase
      .from('services')
      .select('base_price, duration_minutes')
      .eq('id', selection.id)
      .eq('is_active', true)
      .single();
    
    if (error) throw error;
    if (service) {
      totalPrice += service.base_price * selection.quantity;
      totalDuration += service.duration_minutes * selection.quantity;
    }
  }
  
  // Add 15 minute buffer for multi-service bookings
  if (serviceSelections.length > 1) {
    totalDuration += 15;
  }
  
  return { total_price: totalPrice, total_duration: totalDuration };
};

// Example service selection format for the database
export const exampleServiceSelection = [
  { 
    id: "service-uuid-here", 
    name: "TV Mounting",
    price: 99.00,
    quantity: 1
  },
  { 
    id: "service-uuid-here", 
    name: "Hide Cables",
    price: 49.00,
    quantity: 1
  }
];

// Find available workers for a booking (simplified version)
export const findAvailableWorkers = async (
  scheduledDate: Date,
  durationMinutes: number,
  region: string
) => {
  // For now, we'll do a simple query to find workers in the region
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'worker')
    .eq('is_active', true)
    .eq('region', region);
  
  if (error) throw error;
  return data?.map(worker => ({ worker_id: worker.id })) || [];
};

// Create a new booking
export const createBooking = async (bookingData: {
  customer_id: string;
  scheduled_at: string;
  services: any; // JSON format of selected services
  total_price: number;
  total_duration_minutes: number;
  customer_address: string;
  special_instructions?: string;
}) => {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      ...bookingData,
      status: 'pending' as const
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // If a worker was auto-assigned, send them an SMS notification
  if (data.worker_id) {
    try {
      await sendSmsNotification(data.id);
    } catch (smsError) {
      console.error('Failed to send SMS notification:', smsError);
    }
  }
  
  return data;
};

// Send SMS notification to assigned worker
export const sendSmsNotification = async (bookingId: string) => {
  const { data, error } = await supabase
    .functions.invoke('send-sms-notification', {
      body: { bookingId }
    });
  
  if (error) throw error;
  return data;
};

// Process payment for a booking
export const processPayment = async (
  bookingId: string, 
  customerId: string,
  paymentMethodId: string
) => {
  const { data, error } = await supabase
    .functions.invoke('process-payment', {
      body: { bookingId, customerId, paymentMethodId }
    });
  
  if (error) throw error;
  return data;
};

// Update booking status
export const updateBookingStatus = async (bookingId: string, status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled') => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
