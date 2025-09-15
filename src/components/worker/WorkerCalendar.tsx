
import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBookingTimeForContext } from '@/utils/timeUtils';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: {
    'en-US': enUS,
  },
});

interface WorkerCalendarProps {
  workerId?: string;
}

const WorkerCalendar = ({ workerId }: WorkerCalendarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use provided workerId or fall back to current user
  const targetWorkerId = workerId || user?.id;

  useEffect(() => {
    if (targetWorkerId) {
      fetchBookings();
    }
  }, [targetWorkerId]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(name, email, phone),
          service:services(name, description, duration_minutes)
        `)
        .eq('worker_id', targetWorkerId)
        .not('status', 'eq', 'cancelled')
        .order('start_time_utc', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching bookings:', error);
        throw error;
      }

      const calendarEvents = (data || []).map(booking => {
        // Use timezone-aware date handling for America/Chicago
        let eventStart: Date;
        
        if (booking.start_time_utc) {
          eventStart = new Date(booking.start_time_utc);
        } else {
          // For legacy bookings without UTC time, construct from local fields
          const localDateTime = `${booking.scheduled_date}T${booking.scheduled_start}:00`;
          eventStart = new Date(localDateTime);
        }
          
        const eventEnd = new Date(eventStart.getTime() + (booking.service?.duration_minutes || 60) * 60000);
        
        return {
          id: booking.id,
          title: `${booking.customer?.name || 'Guest'} - ${booking.service?.name || 'Service'}`,
          start: eventStart,
          end: eventEnd,
          resource: booking,
        };
      });

      setBookings(calendarEvents);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load calendar events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event) => {
    const booking = event.resource;
    const formattedTime = formatBookingTimeForContext(booking, 'worker');
    
    toast({
      title: `Booking: ${event.title}`,
      description: `Scheduled for ${formattedTime}`,
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{workerId ? 'Worker Calendar' : 'Your Calendar'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={bookings}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            views={['month', 'week', 'day']}
            defaultView="week"
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: '#3174ad',
                borderRadius: '4px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block'
              }
            })}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkerCalendar;
