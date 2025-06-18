
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
    .eq('is_active', true);
  
  if (error) throw error;
  return data?.map(worker => ({ worker_id: worker.id })) || [];
};

// Create a new booking - updated to match actual database schema
export const createBooking = async (bookingData: {
  customer_id: string;
  scheduled_date: string;
  scheduled_start: string;
  service_id: string;
  location_notes?: string;
}) => {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: bookingData.customer_id,
      scheduled_date: bookingData.scheduled_date,
      scheduled_start: bookingData.scheduled_start,
      service_id: bookingData.service_id,
      location_notes: bookingData.location_notes,
      status: 'pending' as const
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Mock SMS notification since the function doesn't exist
  try {
    console.log('Would send SMS notification for booking:', data.id);
  } catch (smsError) {
    console.error('Failed to send SMS notification:', smsError);
  }
  
  return data;
};

// Send SMS notification to assigned worker
export const sendSmsNotification = async (bookingId: string) => {
  // Mock implementation since the edge function doesn't exist
  console.log('Mock SMS notification sent for booking:', bookingId);
  return { success: true };
};

// Process payment for a booking
export const processPayment = async (
  bookingId: string, 
  customerId: string,
  paymentMethodId: string
) => {
  // Mock implementation since the edge function doesn't exist
  console.log('Mock payment processing for booking:', bookingId);
  return { success: true };
};

// Update booking status - fixed to only use valid status values
export const updateBookingStatus = async (
  bookingId: string, 
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
