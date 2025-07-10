
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarContent } from './calendar/CalendarContent';
import { CalendarLegend } from './calendar/CalendarLegend';
import { CalendarLoading } from './calendar/CalendarLoading';

interface Job {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
  customer?: any;
  service?: any;
}

interface WorkerCalendarProps {
  workerId?: string; // Optional workerId for admin viewing other workers
}

const WorkerCalendar = ({ workerId }: WorkerCalendarProps) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Use the provided workerId or fall back to authenticated user
  const targetWorkerId = workerId || user?.id;

  const { isConnected, isRefreshing, forceRefresh } = useCalendarSync({
    userId: targetWorkerId,
    userRole: 'worker',
    onBookingUpdate: () => {
      fetchAllJobs();
    },
    onScheduleUpdate: () => {
      // Optionally fetch schedule changes here
      if (process.env.NODE_ENV === 'development') {
        console.log('Worker schedule updated');
      }
    }
  });

  const fetchAllJobs = async () => {
    if (!targetWorkerId) return;

    try {
      setLoading(true);
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetching all jobs for worker:', targetWorkerId);
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, phone),
          service:services!service_id(name, description, duration_minutes, base_price)
        `)
        .eq('worker_id', targetWorkerId)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_start', { ascending: true });

      if (error) {
        console.error('Error fetching all jobs:', error);
        throw error;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('All jobs data:', data);
      }

      const transformedJobs: Job[] = (data || []).map(job => {
        const startDateTime = new Date(`${job.scheduled_date}T${job.scheduled_start}`);
        const durationMinutes = job.service?.duration_minutes || 60;
        const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

        return {
          id: job.id,
          title: `${job.service?.name || 'Service'} - ${job.customer?.name || 'Customer'}`,
          start: startDateTime,
          end: endDateTime,
          status: job.status,
          customer: job.customer,
          service: job.service
        };
      });

      setJobs(transformedJobs);
    } catch (error) {
      console.error('Error fetching all jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load worker schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetWorkerId) {
      fetchAllJobs();
    }
  }, [targetWorkerId]);

  if (loading) {
    return <CalendarLoading />;
  }

  return (
    <Card className="w-full">
      <CalendarHeader
        workerId={workerId}
        isConnected={isConnected}
        isRefreshing={isRefreshing}
        onRefresh={forceRefresh}
      />
      
      <CardContent>
        <CalendarContent jobs={jobs} />
        <CalendarLegend />
      </CardContent>
    </Card>
  );
};

export default WorkerCalendar;
