
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ScheduleData {
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  notes?: string;
}

export const useWorkerScheduleOperations = (workerId?: string) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Use provided workerId or fall back to authenticated user
  const targetWorkerId = workerId || user?.id;

  const createOrUpdateSchedule = async (scheduleData: ScheduleData) => {
    if (!targetWorkerId) {
      throw new Error('No worker ID available');
    }

    setLoading(true);
    try {
      console.log('Creating/updating schedule for worker:', targetWorkerId, scheduleData);

      // Since the RPC function doesn't exist, we'll use a direct insert/update approach
      const { data: existingSchedule } = await supabase
        .from('worker_schedule')
        .select('*')
        .eq('worker_id', targetWorkerId)
        .eq('work_date', scheduleData.date)
        .eq('start_time', scheduleData.startTime)
        .single();

      let result;
      if (existingSchedule) {
        // Update existing schedule
        result = await supabase
          .from('worker_schedule')
          .update({
            end_time: scheduleData.endTime
          })
          .eq('id', existingSchedule.id)
          .select();
      } else {
        // Create new schedule
        result = await supabase
          .from('worker_schedule')
          .insert({
            worker_id: targetWorkerId,
            work_date: scheduleData.date,
            start_time: scheduleData.startTime,
            end_time: scheduleData.endTime
          })
          .select();
      }

      if (result.error) {
        console.error('Schedule operation error:', result.error);
        
        if (result.error.message?.includes('permission denied')) {
          throw new Error('You don\'t have permission to manage schedules');
        }
        
        if (result.error.message?.includes('violates unique constraint')) {
          throw new Error('A schedule already exists for this time slot');
        }
        
        throw new Error(result.error.message || 'Failed to save schedule');
      }

      console.log('Schedule saved successfully:', result.data);
      
      toast({
        title: "Success",
        description: "Schedule updated successfully",
      });

      return { data: result.data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Schedule operation failed:', error);
      
      toast({
        title: "Schedule Operation Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    setLoading(true);
    try {
      console.log('Deleting schedule:', scheduleId);

      const { error } = await supabase
        .from('worker_schedule')
        .delete()
        .eq('id', scheduleId);

      if (error) {
        console.error('Schedule deletion error:', error);
        
        if (error.message?.includes('row-level security')) {
          throw new Error('You don\'t have permission to delete this schedule');
        }
        
        if (error.code === 'PGRST116') {
          throw new Error('Schedule not found or already deleted');
        }
        
        throw new Error(error.message || 'Failed to delete schedule');
      }

      console.log('Schedule deleted successfully');
      
      toast({
        title: "Success",
        description: "Schedule deleted successfully",
      });

      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Delete schedule operation failed:', error);
      
      toast({
        title: "Schedule Deletion Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulesForDate = async (date: Date) => {
    try {
      if (!targetWorkerId) {
        throw new Error('No worker ID available');
      }

      const formattedDate = date.toISOString().split('T')[0];
      console.log('Fetching schedules for worker:', targetWorkerId, 'date:', formattedDate);

      const { data, error } = await supabase
        .from('worker_schedule')
        .select('*')
        .eq('worker_id', targetWorkerId)
        .eq('work_date', formattedDate)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Schedule fetch error:', error);
        
        if (error.message?.includes('row-level security')) {
          throw new Error('You don\'t have permission to view schedules');
        }
        
        throw new Error(error.message || 'Failed to load schedules');
      }

      console.log('Schedules loaded successfully:', data);
      return { data: data || [], error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Fetch schedules operation failed:', error);
      
      toast({
        title: "Failed to Load Schedules",
        description: errorMessage,
        variant: "destructive",
      });

      return { data: [], error: errorMessage };
    }
  };

  const setWeeklyAvailability = async (availability: any) => {
    if (!targetWorkerId) {
      throw new Error('No worker ID available');
    }

    setLoading(true);
    try {
      console.log('Setting weekly availability for worker:', targetWorkerId, availability);

      const { data, error } = await supabase.rpc('set_worker_weekly_availability', {
        p_worker_id: targetWorkerId,
        p_availability: availability
      });

      if (error) {
        console.error('Weekly availability error:', error);
        throw new Error(error.message || 'Failed to save weekly availability');
      }

      console.log('Weekly availability saved successfully:', data);
      
      toast({
        title: "Success",
        description: "Weekly availability updated successfully",
      });

      return { data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Set weekly availability failed:', error);
      
      toast({
        title: "Weekly Availability Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyAvailability = async () => {
    try {
      if (!targetWorkerId) {
        throw new Error('No worker ID available');
      }

      console.log('Fetching weekly availability for worker:', targetWorkerId);

      const { data, error } = await supabase
        .from('worker_availability')
        .select('*')
        .eq('worker_id', targetWorkerId);

      if (error) {
        console.error('Weekly availability fetch error:', error);
        throw new Error(error.message || 'Failed to load weekly availability');
      }

      // Transform data to the expected format
      const weeklyData: any = {};
      data?.forEach(item => {
        const dayName = item.day_of_week.charAt(0).toUpperCase() + item.day_of_week.slice(1).toLowerCase();
        weeklyData[dayName] = {
          enabled: true,
          start_time: item.start_time,
          end_time: item.end_time
        };
      });

      console.log('Weekly availability loaded successfully:', weeklyData);
      return { data: weeklyData, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Fetch weekly availability failed:', error);
      
      return { data: {}, error: errorMessage };
    }
  };

  return {
    createOrUpdateSchedule,
    deleteSchedule,
    fetchSchedulesForDate,
    setWeeklyAvailability,
    fetchWeeklyAvailability,
    loading
  };
};
