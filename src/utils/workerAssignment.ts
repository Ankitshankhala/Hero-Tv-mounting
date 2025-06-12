
import { supabase } from '@/integrations/supabase/client';

export const findAvailableWorker = async (region: string, scheduledAt: Date) => {
  try {
    console.log('Finding available worker for region:', region, 'at time:', scheduledAt);
    
    // Get all active workers in the region
    const { data: workers, error } = await supabase
      .from('users')
      .select('id, name, region')
      .eq('role', 'worker')
      .eq('is_active', true)
      .eq('region', region);

    if (error) {
      console.error('Error fetching workers:', error);
      return null;
    }

    if (!workers || workers.length === 0) {
      console.log('No workers available in region:', region);
      return null;
    }

    console.log('Found workers in region:', workers);

    // For now, just return the first available worker
    // In a real system, you'd check their schedules and availability
    const assignedWorker = workers[0];
    console.log('Assigning worker:', assignedWorker);
    
    return assignedWorker;
  } catch (error) {
    console.error('Error in findAvailableWorker:', error);
    return null;
  }
};

export const autoAssignWorker = async (bookingId: string) => {
  try {
    console.log('Auto-assigning worker for booking:', bookingId);
    
    // First, get the booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_at,
        customer_id,
        customer:users!customer_id(region)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking for auto-assignment:', bookingError);
      return null;
    }

    const region = booking.customer?.region;
    if (!region) {
      console.log('No region found for customer, cannot auto-assign worker');
      return null;
    }

    // Find an available worker
    const worker = await findAvailableWorker(region, new Date(booking.scheduled_at));
    
    if (!worker) {
      console.log('No available worker found for auto-assignment');
      return null;
    }

    // Assign the worker to the booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        worker_id: worker.id,
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select(`
        *,
        customer:users!customer_id(name, phone, region),
        worker:users!worker_id(name, phone)
      `)
      .single();

    if (updateError) {
      console.error('Error updating booking with worker assignment:', updateError);
      return null;
    }

    console.log('Worker auto-assigned successfully:', updatedBooking);
    return updatedBooking;
  } catch (error) {
    console.error('Error in autoAssignWorker:', error);
    return null;
  }
};
