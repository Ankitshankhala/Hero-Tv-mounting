
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export const useWorkerAvailability = () => {
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const fetchWorkerAvailability = async (date: Date, zipcode: string, serviceDurationMinutes: number = 60) => {
    if (!zipcode || !date) return;
    
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Use the new enhanced availability function
      const { data: availabilityData, error } = await supabase.rpc('get_available_time_slots', {
        p_zipcode: zipcode,
        p_date: dateStr,
        p_service_duration_minutes: serviceDurationMinutes
      });

      if (error) {
        console.error('Error fetching availability:', error);
        // Fallback to old method if RPC fails
        await fetchWorkerAvailabilityFallback(date, zipcode);
        return;
      }

      if (availabilityData && availabilityData.length > 0) {
        const available = availabilityData.map((slot: any) => slot.time_slot);
        const totalWorkers = Math.max(...availabilityData.map((slot: any) => slot.available_workers));
        
        setAvailableSlots(available);
        setBlockedSlots(timeSlots.filter(slot => !available.includes(slot)));
        setWorkerCount(totalWorkers);
      } else {
        // No available slots
        setAvailableSlots([]);
        setBlockedSlots(timeSlots);
        setWorkerCount(0);
      }
    } catch (error) {
      console.error('Error fetching worker availability:', error);
      // Fallback to old method
      await fetchWorkerAvailabilityFallback(date, zipcode);
    } finally {
      setLoading(false);
    }
  };

  // Fallback method using the old logic for backward compatibility
  const fetchWorkerAvailabilityFallback = async (date: Date, zipcode: string) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          scheduled_start,
          worker_bookings!inner(
            worker_id,
            users!inner(zip_code)
          )
        `)
        .eq('scheduled_date', dateStr)
        .eq('status', 'confirmed');

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      const zipcodePrefix = zipcode.substring(0, 3);
      const relevantBookings = bookings?.filter(booking => {
        const workerZipcode = booking.worker_bookings?.[0]?.users?.zip_code;
        return workerZipcode && workerZipcode.substring(0, 3) === zipcodePrefix;
      }) || [];

      const { data: workers, error: workerError } = await supabase
        .from('users')
        .select('id, zip_code')
        .eq('role', 'worker')
        .eq('is_active', true);

      if (!workerError) {
        const availableWorkers = workers?.filter(worker => 
          worker.zip_code && worker.zip_code.substring(0, 3) === zipcodePrefix
        ) || [];
        setWorkerCount(availableWorkers.length);
      }

      const blocked = relevantBookings.map(booking => 
        booking.scheduled_start.substring(0, 5)
      );

      setBlockedSlots(blocked);
      setAvailableSlots(timeSlots.filter(slot => !blocked.includes(slot)));
    } catch (error) {
      console.error('Error in fallback availability check:', error);
      setAvailableSlots(timeSlots);
      setBlockedSlots([]);
      setWorkerCount(0);
    }
  };

  return {
    availableSlots,
    blockedSlots,
    workerCount,
    loading,
    timeSlots,
    fetchWorkerAvailability
  };
};
