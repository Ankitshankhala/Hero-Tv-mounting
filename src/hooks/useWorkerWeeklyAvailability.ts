
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WeeklyAvailability {
  [key: string]: {
    enabled: boolean;
    start_time: string;
    end_time: string;
  };
}

export const useWorkerWeeklyAvailability = (workerId?: string) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchWeeklyAvailability = async (targetWorkerId: string): Promise<WeeklyAvailability> => {
    try {
      const { data, error } = await supabase
        .from('worker_availability')
        .select('day_of_week, start_time, end_time')
        .eq('worker_id', targetWorkerId);

      if (error) throw error;

      // Convert to the expected format
      const availability: WeeklyAvailability = {
        Monday: { enabled: false, start_time: '09:00', end_time: '17:00' },
        Tuesday: { enabled: false, start_time: '09:00', end_time: '17:00' },
        Wednesday: { enabled: false, start_time: '09:00', end_time: '17:00' },
        Thursday: { enabled: false, start_time: '09:00', end_time: '17:00' },
        Friday: { enabled: false, start_time: '09:00', end_time: '17:00' },
        Saturday: { enabled: false, start_time: '09:00', end_time: '17:00' },
        Sunday: { enabled: false, start_time: '09:00', end_time: '17:00' },
      };

      data?.forEach((record) => {
        const dayName = record.day_of_week.charAt(0).toUpperCase() + record.day_of_week.slice(1).toLowerCase();
        if (availability[dayName]) {
          availability[dayName] = {
            enabled: true,
            start_time: record.start_time,
            end_time: record.end_time,
          };
        }
      });

      return availability;
    } catch (error) {
      console.error('Error fetching weekly availability:', error);
      throw error;
    }
  };

  const saveWeeklyAvailability = async (targetWorkerId: string, availability: WeeklyAvailability) => {
    if (!targetWorkerId) {
      throw new Error('Worker ID is required');
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('set_worker_weekly_availability', {
        p_worker_id: targetWorkerId,
        p_availability: availability
      });

      if (error) {
        console.error('Error saving weekly availability:', error);
        throw new Error(error.message || 'Failed to save weekly availability');
      }

      toast({
        title: "Success",
        description: "Weekly availability saved successfully",
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Save weekly availability failed:', error);
      
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      });

      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchWeeklyAvailability,
    saveWeeklyAvailability,
    loading
  };
};
