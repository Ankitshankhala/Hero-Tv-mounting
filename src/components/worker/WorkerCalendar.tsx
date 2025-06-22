
import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Job {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
  customer?: any;
  service?: any;
}

const WorkerCalendar = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchJobsForDate = async (date: Date) => {
    if (!user) return;

    try {
      console.log('Fetching jobs for date:', date.toISOString().split('T')[0]);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, phone),
          service:services!service_id(name, description)
        `)
        .eq('worker_id', user.id)
        .eq('scheduled_date', date.toISOString().split('T')[0])
        .order('scheduled_start', { ascending: true });

      if (error) {
        console.error('Error fetching jobs:', error);
        throw error;
      }

      console.log('Jobs data:', data);

      const transformedJobs: Job[] = (data || []).map(job => {
        // Create start datetime by combining scheduled_date and scheduled_start
        const startDateTime = new Date(`${job.scheduled_date}T${job.scheduled_start}`);
        
        // Calculate end time based on service duration or default to 1 hour
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
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs for the selected date",
        variant: "destructive",
      });
    }
  };

  const fetchAllJobs = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Fetching all jobs for worker:', user.id);

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, phone),
          service:services!service_id(name, description)
        `)
        .eq('worker_id', user.id)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_start', { ascending: true });

      if (error) {
        console.error('Error fetching all jobs:', error);
        throw error;
      }

      console.log('All jobs data:', data);

      const transformedJobs: Job[] = (data || []).map(job => {
        // Create start datetime by combining scheduled_date and scheduled_start
        const startDateTime = new Date(`${job.scheduled_date}T${job.scheduled_start}`);
        
        // Calculate end time based on service duration or default to 1 hour
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
    fetchAllJobs();
  }, [user]);

  const eventStyleGetter = (event: Job) => {
    let backgroundColor = '#3174ad';
    
    switch (event.status) {
      case 'pending':
        backgroundColor = '#f59e0b';
        break;
      case 'confirmed':
        backgroundColor = '#10b981';
        break;
      case 'in_progress':
        backgroundColor = '#3b82f6';
        break;
      case 'completed':
        backgroundColor = '#6b7280';
        break;
      case 'cancelled':
        backgroundColor = '#ef4444';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="h-96 bg-white p-4 rounded-lg border">
      <Calendar
        localizer={localizer}
        events={jobs}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        eventPropGetter={eventStyleGetter}
        onNavigate={(date) => fetchJobsForDate(date)}
        views={['month', 'week', 'day']}
        defaultView="month"
        popup
        onSelectEvent={(event) => {
          toast({
            title: event.title,
            description: `Status: ${event.status}`,
          });
        }}
      />
    </div>
  );
};

export default WorkerCalendar;
