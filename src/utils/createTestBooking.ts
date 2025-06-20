
import { supabase } from '@/integrations/supabase/client';

export const createTestBooking = async () => {
  try {
    // First, get a service to use for the booking
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .limit(1);

    if (servicesError || !services?.length) {
      throw new Error('No services available');
    }

    const service = services[0];

    // Create a test customer if needed
    const { data: existingCustomer } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'customer@test.com')
      .eq('role', 'customer')
      .single();

    let customerId = existingCustomer?.id;

    if (!existingCustomer) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('users')
        .insert({
          email: 'customer@test.com',
          name: 'Test Customer',
          phone: '+1-555-987-6543',
          city: 'Los Angeles',
          zip_code: '90210',
          role: 'customer'
        })
        .select()
        .single();

      if (customerError) throw customerError;
      customerId = newCustomer.id;
    }

    // Create a test booking assigned to our worker
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: customerId,
        worker_id: 'a1b2c3d4-5678-90ab-cdef-123456789012', // Our test worker ID
        service_id: service.id,
        scheduled_date: tomorrow.toISOString().split('T')[0],
        scheduled_start: '10:00:00',
        location_notes: '123 Test Street, Los Angeles, CA 90210',
        status: 'confirmed'
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    return booking;
  } catch (error) {
    console.error('Error creating test booking:', error);
    throw error;
  }
};
