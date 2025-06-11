
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

export const useWorkerScheduleOperations = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const createOrUpdateSchedule = async (scheduleData: ScheduleData) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    try {
      console.log('Creating/updating schedule:', scheduleData);

      const { data, error } = await supabase
        .rpc('upsert_worker_schedule', {
          p_worker_id: user.id,
          p_date: scheduleData.date,
          p_start_time: scheduleData.startTime,
          p_end_time: scheduleData.endTime,
          p_is_available: scheduleData.isAvailable,
          p_notes: scheduleData.notes || null
        });

      if (error) {
        console.error('Schedule operation error:', error);
        
        if (error.message?.includes('permission denied')) {
          throw new Error('You don\'t have permission to manage schedules');
        }
        
        if (error.message?.includes('violates unique constraint')) {
          throw new Error('A schedule already exists for this time slot');
        }
        
        throw new Error(error.message || 'Failed to save schedule');
      }

      console.log('Schedule saved successfully:', data);
      
      toast({
        title: "Success",
        description: "Schedule updated successfully",
      });

      return { data, error: null };
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
        .from('worker_schedules')
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
      if (!user) {
        throw new Error('User not authenticated');
      }

      const formattedDate = date.toISOString().split('T')[0];
      console.log('Fetching schedules for date:', formattedDate);

      const { data, error } = await supabase
        .from('worker_schedules')
        .select('*')
        .eq('worker_id', user.id)
        .eq('date', formattedDate)
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

  return {
    createOrUpdateSchedule,
    deleteSchedule,
    fetchSchedulesForDate,
    loading
  };
};
