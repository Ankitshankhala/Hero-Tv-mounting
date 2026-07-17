
import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { enUS } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBookingTimeForContext } from '@/utils/timeUtils';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/styles/rbc-worker-dark.css';

const TZ = 'America/Chicago';

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

const statusToken = (status?: string) => {
  switch (status) {
    case 'pending':
      return 'var(--status-pending)';
    case 'confirmed':
    case 'in_progress':
      return 'var(--status-confirmed)';
    case 'completed':
      return 'var(--status-completed)';
    case 'cancelled':
      return 'var(--status-cancelled)';
    default:
      return 'var(--status-confirmed)';
  }
};

const WorkerCalendar = ({ workerId }: WorkerCalendarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      if (error) throw error;

      const calendarEvents = (data || []).map(booking => {
        let eventStart: Date;

        if (booking.start_time_utc) {
          eventStart = toZonedTime(new Date(booking.start_time_utc), TZ);
        } else {
          // Legacy fallback
          const localDateTime = `${booking.scheduled_date}T${booking.scheduled_start}:00`;
          eventStart = new Date(localDateTime);
        }

        const durationMin = booking.service?.duration_minutes || 60;
        const eventEnd = new Date(eventStart.getTime() + durationMin * 60000);

        const guestInfo = (booking as any).guest_customer_info || {};
        const customerName =
          booking.customer?.name || guestInfo.name || 'Customer';
        const serviceName = booking.service?.name || 'Service';

        return {
          id: booking.id,
          title: `${customerName} - ${serviceName}`,
          start: eventStart,
          end: eventEnd,
          status: booking.status,
          resource: booking,
        };
      });

      setBookings(calendarEvents);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event: any) => {
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
        <p className="text-xs text-muted-foreground mt-1">
          Times shown in Central Time (Austin, TX)
        </p>
      </CardHeader>
      <CardContent>
        <div className="rbc-worker-dark" style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={bookings}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            views={['month', 'week', 'day']}
            defaultView="week"
            popup
            eventPropGetter={(event: any) => ({
              style: {
                backgroundColor: `hsl(${statusToken(event.status)})`,
                borderRadius: '4px',
                opacity: 0.95,
                color: '#fff',
                border: '0px',
                display: 'block',
              },
            })}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkerCalendar;
