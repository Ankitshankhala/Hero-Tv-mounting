
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { supabase } from '@/integrations/supabase/client';

export const useWorkerAvailability = () => {
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [nextAvailableDate, setNextAvailableDate] = useState<Date | null>(null);
  const [availableWorkers, setAvailableWorkers] = useState<any[]>([]);
  const [preferredWorkerAvailable, setPreferredWorkerAvailable] = useState(false);

  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

  const findNextAvailableDate = async (startDate: Date, zipcode: string) => {
    if (!zipcode) return null;
    
    // Check next 30 days for availability
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() + i);
      
      const dateStr = formatInTimeZone(checkDate, 'America/Chicago', 'yyyy-MM-dd');
      
      try {
        const { data: availableSlots, error } = await supabase.rpc('get_available_time_slots', {
          p_zipcode: zipcode,
          p_date: dateStr,
          p_service_duration_minutes: 60
        });
        
        if (!error && availableSlots && availableSlots.length > 0) {
          return checkDate;
        }
      } catch (error) {
        console.error('Error checking date availability:', error);
      }
    }
    
    return null;
  };

  const fetchWorkerAvailability = async (date: Date, zipcode: string, preferredWorkerId?: string) => {
    if (!zipcode || !date) return;
    
    setLoading(true);
    try {
      // Use America/Chicago timezone for all date operations
      const dateStr = formatInTimeZone(date, 'America/Chicago', 'yyyy-MM-dd');
      const nowInChicago = toZonedTime(new Date(), 'America/Chicago');
      const todayStr = formatInTimeZone(nowInChicago, 'America/Chicago', 'yyyy-MM-dd');
      const isToday = dateStr === todayStr;
      const currentHour = nowInChicago.getHours();
      
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
      const slots = availableSlots?.map(slot => {
        // Convert "HH:MM:SS" format to "HH:MM" format to match frontend expectations
        const timeStr = slot.time_slot.toString();
        return timeStr.substring(0, 5); // Extract first 5 characters (HH:MM)
      }) || [];
      const totalWorkerIds = new Set();
      availableSlots?.forEach(slot => {
        slot.worker_ids?.forEach(id => totalWorkerIds.add(id));
      });
      
      // Filter out past time slots for same-day booking using America/Chicago timezone
      const availableTimeSlots = slots.filter(slot => {
        // For same-day booking, only allow slots that are at least 30 minutes from now
        if (isToday) {
          const [hours] = slot.split(':').map(Number);
          const currentMinutes = nowInChicago.getMinutes();
          const slotMinutes = hours * 60;
          const nowMinutes = currentHour * 60 + currentMinutes;
          
          // Allow booking if slot is at least 30 minutes in the future
          return slotMinutes > nowMinutes + 30;
        }
        
        return true;
      });

      // Blocked slots are all time slots that are not available
      const blockedSlots = timeSlots.filter(slot => !slots.includes(slot));

      // Check if preferred worker is available
      let isPreferredWorkerAvailable = false;
      if (preferredWorkerId) {
        isPreferredWorkerAvailable = Array.from(totalWorkerIds).includes(preferredWorkerId);
      }

      setAvailableSlots(availableTimeSlots);
      setBlockedSlots(blockedSlots);
      setWorkerCount(totalWorkerIds.size);
      setPreferredWorkerAvailable(isPreferredWorkerAvailable);
      
      // Store available workers info for potential future use
      const workersInfo = availableSlots?.flatMap(slot => 
        slot.worker_ids?.map(workerId => ({ 
          id: workerId, 
          timeSlot: slot.time_slot.toString().substring(0, 5) 
        })) || []
      ) || [];
      setAvailableWorkers(workersInfo);
      
      // If no workers or no available slots, find next available date
      if (totalWorkerIds.size === 0 || availableTimeSlots.length === 0) {
        const nextDate = await findNextAvailableDate(date, zipcode);
        setNextAvailableDate(nextDate);
      } else {
        setNextAvailableDate(null);
      }
    } catch (error) {
      console.error('Error fetching worker availability:', error);
      setAvailableSlots([]);
      setBlockedSlots([]);
      setWorkerCount(0);
      setNextAvailableDate(null);
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
    nextAvailableDate,
    availableWorkers,
    preferredWorkerAvailable,
    fetchWorkerAvailability,
    findNextAvailableDate
  };
};
