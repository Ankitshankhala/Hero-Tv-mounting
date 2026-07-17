
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMinutes, startOfMonth, endOfMonth, subDays, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CalendarIcon, RefreshCw, Users, MapPin, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/styles/rbc-dark.css';

const locales = { 'en-US': enUS };
const SERVICE_TZ = 'America/Chicago';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: BookingStatus;
  worker?: any;
  customer?: any;
  customerName: string;
  location: string;
  service?: any;
  resource?: any;
}

export const AdminCalendarView = React.memo(() => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Track the visible range so realtime refreshes stay scoped
  const rangeRef = useRef<{ start: Date; end: Date }>({
    start: subDays(startOfMonth(new Date()), 7),
    end: addDays(endOfMonth(new Date()), 7),
  });

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const { start, end } = rangeRef.current;

      let query = supabase
        .from('bookings')
        .select(`
          id,
          status,
          scheduled_date,
          scheduled_start,
          start_time_utc,
          worker_id,
          customer_id,
          guest_customer_info,
          service_id,
          customer:users!customer_id(name, email, phone, city),
          worker:users!worker_id(name, email, phone),
          service:services!service_id(name, description, duration_minutes, base_price)
        `)
        .gte('start_time_utc', start.toISOString())
        .lte('start_time_utc', end.toISOString())
        .order('start_time_utc', { ascending: true });

      if (selectedWorker !== 'all') {
        query = query.eq('worker_id', selectedWorker);
      }
      if (selectedStatus !== 'all' && (['pending', 'confirmed', 'completed', 'cancelled'] as const).includes(selectedStatus as BookingStatus)) {
        query = query.eq('status', selectedStatus as BookingStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const transformed: CalendarEvent[] = (data || [])
        .filter((b: any) => !!b.start_time_utc)
        .map((booking: any) => {
          const startCT = toZonedTime(new Date(booking.start_time_utc), SERVICE_TZ);
          const duration = booking.service?.duration_minutes || 60;
          const endCT = addMinutes(startCT, duration);

          const guest = booking.guest_customer_info || {};
          const customerName = booking.customer?.name || guest.name || 'Guest';
          const location = booking.customer?.city || guest.city || '';
          const workerName = booking.worker?.name || 'Unassigned';
          const serviceName = booking.service?.name || 'Service';

          const validStatus: BookingStatus = (['pending', 'confirmed', 'completed', 'cancelled'] as const)
            .includes(booking.status as BookingStatus)
            ? (booking.status as BookingStatus)
            : 'pending';

          return {
            id: booking.id,
            title: `${serviceName} — ${customerName} (${workerName})`,
            start: startCT,
            end: endCT,
            status: validStatus,
            worker: booking.worker,
            customer: booking.customer,
            customerName,
            location,
            service: booking.service,
            resource: booking,
          };
        });

      setEvents(transformed);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching calendar events:', error);
      }
      toast({
        title: 'Error',
        description: 'Failed to load calendar events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedWorker, selectedStatus, toast]);

  const { isConnected, isRefreshing, forceRefresh } = useCalendarSync({
    userRole: 'admin',
    onBookingUpdate: fetchEvents,
  });

  const fetchWorkers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'worker')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching workers:', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRangeChange = useCallback((range: any) => {
    let start: Date;
    let end: Date;
    if (Array.isArray(range)) {
      start = range[0];
      end = range[range.length - 1];
    } else if (range?.start && range?.end) {
      start = range.start;
      end = range.end;
    } else {
      return;
    }
    // buffer +/- 1 day
    rangeRef.current = { start: subDays(start, 1), end: addDays(end, 1) };
    fetchEvents();
  }, [fetchEvents]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const token = `hsl(var(--status-${event.status}))`;
    return {
      style: {
        backgroundColor: token,
        borderRadius: '5px',
        opacity: 0.9,
        color: 'hsl(var(--primary-foreground))',
        border: '0px',
        display: 'block',
      },
    };
  }, []);

  const handleEventSelect = useCallback((event: CalendarEvent) => {
    toast({
      title: `${event.service?.name || 'Service'}`,
      description: (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Badge variant="outline">{event.status}</Badge>
          </div>
          <div><strong>Customer:</strong> {event.customerName}</div>
          <div><strong>Worker:</strong> {event.worker?.name || 'Unassigned'}</div>
          <div><strong>Location:</strong> {event.location || '—'}</div>
          <div><strong>Time (CT):</strong> {format(event.start, 'PPp')}</div>
        </div>
      ),
    });
  }, [toast]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5" />
            <span>Admin Calendar View</span>
            {isConnected && (
              <Badge variant="outline" className="text-[hsl(var(--status-completed))]">
                ● Live
              </Badge>
            )}
          </CardTitle>
          <Button onClick={forceRefresh} disabled={isRefreshing} size="sm" variant="outline">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">Times shown in Central Time (Austin, TX)</p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by worker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map((worker: any) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4" />
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading calendar...</span>
          </div>
        ) : (
          <div className="h-96">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={handleEventSelect}
              onRangeChange={handleRangeChange}
              views={['month', 'week', 'day']}
              defaultView="week"
              popup
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge style={{ backgroundColor: 'hsl(var(--status-pending))', color: 'hsl(var(--primary-foreground))' }}>Pending</Badge>
          <Badge style={{ backgroundColor: 'hsl(var(--status-confirmed))', color: 'hsl(var(--primary-foreground))' }}>Confirmed</Badge>
          <Badge style={{ backgroundColor: 'hsl(var(--status-completed))', color: 'hsl(var(--primary-foreground))' }}>Completed</Badge>
          <Badge style={{ backgroundColor: 'hsl(var(--status-cancelled))', color: 'hsl(var(--primary-foreground))' }}>Cancelled</Badge>
        </div>
      </CardContent>
    </Card>
  );
});
