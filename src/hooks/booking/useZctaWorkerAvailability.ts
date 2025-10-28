import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { supabase } from '@/integrations/supabase/client';
import { findZctaAvailableWorkers } from '@/utils/zctaServiceCoverage';
import { zctaOnlyService } from '@/services/zctaOnlyService';

/**
 * Enhanced worker availability hook that uses ZCTA data for improved accuracy
 */
export const useZctaWorkerAvailability = () => {
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [nextAvailableDate, setNextAvailableDate] = useState<Date | null>(null);
  const [availableWorkers, setAvailableWorkers] = useState<any[]>([]);
  const [preferredWorkerAvailable, setPreferredWorkerAvailable] = useState(false);
  const [workerSpecificSlots, setWorkerSpecificSlots] = useState<string[]>([]);
  const [showAllWorkerSlots, setShowAllWorkerSlots] = useState(false);
  const [availabilitySource, setAvailabilitySource] = useState<'zcta' | 'database' | 'none'>('none');

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
        // Try ZCTA-based availability check first
        const zctaWorkers = await findZctaAvailableWorkers(
          zipcode, 
          dateStr, 
          '09:00', // Check a standard time
          60
        );
        
        if (zctaWorkers.length > 0) {
          return checkDate;
        }

        // Fallback to database check
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
      
      // ✅ HYBRID APPROACH: ZCTA for validation/location, Database for strict worker matching
      let availabilityDataSource: 'zcta' | 'database' = 'database';
      let allAvailableSlots: any[] = [];
      
      // PHASE 1: ZCTA Validation (optional - for location data enrichment)
      // This doesn't affect booking logic but enriches UX with city/state info
      try {
        const validation = await zctaOnlyService.validateZctaCode(zipcode);
        if (validation.is_valid) {
          console.log(`[Hybrid Availability] ✓ ZCTA validated: ${validation.city}, ${validation.state_abbr}`);
        }
      } catch (zctaError) {
        console.warn('[Hybrid Availability] ZCTA validation skipped:', zctaError);
      }
      
      // PHASE 2: Database Lookup (STRICT ZIP MATCHING - source of truth for workers)
      console.log('[Hybrid Availability] Fetching workers via database (strict ZIP match)');
      const { data: availableSlots, error } = await supabase.rpc('get_available_time_slots', {
        p_zipcode: zipcode,
        p_date: dateStr,
        p_service_duration_minutes: 60
      });

      if (error) {
        console.error('[Hybrid Availability] Error fetching available time slots:', error);
        setAvailableSlots([]);
        setBlockedSlots([]);
        setWorkerCount(0);
        setAvailabilitySource('none');
        return;
      }

      allAvailableSlots = availableSlots || [];
      availabilityDataSource = 'database';
      setAvailabilitySource('database');
      
      console.log(`[Hybrid Availability] Found ${allAvailableSlots.length} slots via database (strict ZIP match)`);

      // Extract available time slots and worker count
      const slots = allAvailableSlots.map(slot => {
        // Convert "HH:MM:SS" format to "HH:MM" format to match frontend expectations
        const timeStr = slot.time_slot.toString();
        return timeStr.includes(':') ? timeStr.substring(0, 5) : timeStr;
      });

      const totalWorkerIds = new Set();
      allAvailableSlots.forEach(slot => {
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

      // Check if preferred worker is available and get their specific slots
      let isPreferredWorkerAvailable = false;
      let workerSpecificTimeSlots: string[] = [];
      
      if (preferredWorkerId) {
        isPreferredWorkerAvailable = Array.from(totalWorkerIds).includes(preferredWorkerId);
        
        // Get slots where the preferred worker is available
        if (isPreferredWorkerAvailable) {
          workerSpecificTimeSlots = allAvailableSlots
            .filter(slot => slot.worker_ids?.includes(preferredWorkerId))
            .map(slot => {
              const timeStr = slot.time_slot.toString();
              return timeStr.includes(':') ? timeStr.substring(0, 5) : timeStr;
            });
          
          // Filter out past time slots for same-day booking
          workerSpecificTimeSlots = workerSpecificTimeSlots.filter(slot => {
            if (isToday) {
              const [hours] = slot.split(':').map(Number);
              const currentMinutes = nowInChicago.getMinutes();
              const slotMinutes = hours * 60;
              const nowMinutes = currentHour * 60 + currentMinutes;
              return slotMinutes > nowMinutes + 30;
            }
            return true;
          });

          // Filter worker-specific slots based on their weekly schedule
          try {
            const dayOfWeek = format(date, 'EEEE') as 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
            const { data: weeklySchedule, error: scheduleError } = await supabase
              .from('worker_availability')
              .select('*')
              .eq('worker_id', preferredWorkerId)
              .eq('day_of_week', dayOfWeek);

            if (!scheduleError && weeklySchedule && weeklySchedule.length > 0) {
              const daySchedule = weeklySchedule[0];
              const startTime = daySchedule.start_time;
              const endTime = daySchedule.end_time;
              
              // Filter slots to only include those within the worker's schedule
              workerSpecificTimeSlots = workerSpecificTimeSlots.filter(slot => {
                const slotTime = slot + ':00'; // Convert HH:MM to HH:MM:SS for comparison
                return slotTime >= startTime && slotTime < endTime;
              });
            } else {
              // Worker is not available on this day according to their weekly schedule
              workerSpecificTimeSlots = [];
            }
          } catch (scheduleError) {
            console.error('Error fetching worker weekly schedule:', scheduleError);
            // Continue with original slots if schedule fetch fails
          }
        }
      }

      setAvailableSlots(availableTimeSlots);
      setBlockedSlots(blockedSlots);
      setWorkerCount(totalWorkerIds.size);
      setPreferredWorkerAvailable(isPreferredWorkerAvailable);
      setWorkerSpecificSlots(workerSpecificTimeSlots);
      
      // Store available workers info for potential future use
      const workersInfo = allAvailableSlots.flatMap(slot => 
        slot.worker_ids?.map(workerId => ({ 
          id: workerId, 
          timeSlot: slot.time_slot.toString().includes(':') 
            ? slot.time_slot.toString().substring(0, 5) 
            : slot.time_slot.toString(),
          source: availabilityDataSource
        })) || []
      );
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
      setAvailabilitySource('none');
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
    workerSpecificSlots,
    showAllWorkerSlots,
    availabilitySource, // New: indicates data source
    setShowAllWorkerSlots,
    fetchWorkerAvailability,
    findNextAvailableDate
  };
};