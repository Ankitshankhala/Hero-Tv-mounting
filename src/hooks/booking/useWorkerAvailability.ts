
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export const useWorkerAvailability = () => {
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

  const fetchWorkerAvailability = async (date: Date, zipcode: string) => {
    if (!zipcode || !date) return;
    
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const now = new Date();
      const isToday = dateStr === format(now, 'yyyy-MM-dd');
      const currentHour = now.getHours();
      
      // Use the database function to get available time slots
      const { data: availableSlots, error } = await supabase.rpc('get_available_time_slots', {
        p_zipcode: zipcode,
        p_date: dateStr,
        p_service_duration_minutes: 60
      });

      if (error) {
        console.error('Error fetching available time slots:', error);
        setAvailableSlots([]);
        setBlockedSlots([]);
        setWorkerCount(0);
        return;
      }

      // Extract available time slots and worker count
      const slots = availableSlots?.map(slot => slot.time_slot) || [];
      const totalWorkerIds = new Set();
      availableSlots?.forEach(slot => {
        slot.worker_ids?.forEach(id => totalWorkerIds.add(id));
      });
      
      // Filter out past time slots for same-day booking
      const availableTimeSlots = slots.filter(slot => {
        // For same-day booking, only allow slots that are at least 30 minutes from now
        if (isToday) {
          const [hours] = slot.split(':').map(Number);
          const currentMinutes = now.getMinutes();
          const slotMinutes = hours * 60;
          const nowMinutes = currentHour * 60 + currentMinutes;
          
          // Allow booking if slot is at least 30 minutes in the future
          return slotMinutes > nowMinutes + 30;
        }
        
        return true;
      });

      // Blocked slots are all time slots that are not available
      const blockedSlots = timeSlots.filter(slot => !slots.includes(slot));

      setAvailableSlots(availableTimeSlots);
      setBlockedSlots(blockedSlots);
      setWorkerCount(totalWorkerIds.size);
    } catch (error) {
      console.error('Error fetching worker availability:', error);
      setAvailableSlots([]);
      setBlockedSlots([]);
      setWorkerCount(0);
    } finally {
      setLoading(false);
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
