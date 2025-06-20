
import { supabase } from '@/integrations/supabase/client';
import { createBookingWithWorkerAssignment, type BookingData } from '@/utils/bookingLogic';

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

// Create a new booking using the enhanced booking logic
export const createBooking = async (bookingData: BookingData) => {
  return await createBookingWithWorkerAssignment(bookingData);
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
