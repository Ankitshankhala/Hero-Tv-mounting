
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

    // Create a test booking with payment authorization for capture testing
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: customerId,
        worker_id: '1d6b0847-7e4c-454a-be20-9a843e9b6df3', // Use the actual worker ID from the system
        service_id: service.id,
        scheduled_date: tomorrow.toISOString().split('T')[0],
        scheduled_start: '10:00:00',
        location_notes: '123 Test Street, Los Angeles, CA 90210',
        status: 'confirmed',
        payment_intent_id: 'pi_test_' + Math.random().toString(36).substr(2, 9),
        payment_status: 'authorized'
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Create a corresponding transaction record for the authorized payment
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        booking_id: booking.id,
        payment_intent_id: booking.payment_intent_id,
        amount: service.base_price * 100, // Convert to cents
        currency: 'usd',
        status: 'authorized'
      });

    if (bookingError) throw bookingError;

    return booking;
  } catch (error) {
    console.error('Error creating test booking:', error);
    throw error;
  }
};
