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

// Calculate total price and duration for selected services
export const calculateBookingTotals = async (serviceSelections: { id: string, quantity: number }[]) => {
  // Extract arrays for the function parameters
  const serviceIds = serviceSelections.map(s => s.id);
  const quantities = serviceSelections.map(s => s.quantity);
  
  const { data, error } = await supabase
    .rpc('calculate_booking_total', { 
      service_ids: serviceIds, 
      quantities: quantities 
    });
  
  if (error) throw error;
  return data;
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

// Find available workers for a booking
export const findAvailableWorkers = async (
  scheduledDate: Date,
  durationMinutes: number,
  region: string
) => {
  const formattedDate = scheduledDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const formattedTime = scheduledDate.toTimeString().split(' ')[0]; // Format: HH:MM:SS
  
  const { data, error } = await supabase
    .rpc('find_available_workers', {
      job_date: formattedDate,
      job_time: formattedTime,
      job_duration: durationMinutes,
      job_region: region
    });
  
  if (error) throw error;
  return data;
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
    .insert(bookingData)
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
export const updateBookingStatus = async (bookingId: string, status: string) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
