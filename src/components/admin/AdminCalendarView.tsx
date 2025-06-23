
import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, RefreshCw, Users, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCalendarSync } from '@/hooks/useCalendarSync';
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

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: BookingStatus;
  worker?: any;
  customer?: any;
  service?: any;
  resource?: any;
}

export const AdminCalendarView = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const { isConnected, isRefreshing, forceRefresh } = useCalendarSync({
    userRole: 'admin',
    onBookingUpdate: () => {
      fetchEvents();
    }
  });

  useEffect(() => {
    fetchWorkers();
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [selectedWorker, selectedStatus]);

  const fetchWorkers = async () => {
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
      console.error('Error fetching workers:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, email, phone, city),
          worker:users!worker_id(name, email, phone),
          service:services!service_id(name, description, duration_minutes, base_price)
        `)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_start', { ascending: true });

      // Apply worker filter
      if (selectedWorker !== 'all') {
        query = query.eq('worker_id', selectedWorker);
      }

      // Apply status filter - only filter if selectedStatus is a valid BookingStatus
      if (selectedStatus !== 'all' && (['pending', 'confirmed', 'completed', 'cancelled'] as const).includes(selectedStatus as BookingStatus)) {
        query = query.eq('status', selectedStatus as BookingStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      const transformedEvents: CalendarEvent[] = (data || []).map(booking => {
        const startDateTime = new Date(`${booking.scheduled_date}T${booking.scheduled_start}`);
        const durationMinutes = booking.service?.duration_minutes || 60;
        const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

        const workerName = booking.worker?.name || 'Unassigned';
        const customerName = booking.customer?.name || 'Unknown';
        const serviceName = booking.service?.name || 'Service';

        // Ensure status is one of the valid enum values
        const validStatus: BookingStatus = (['pending', 'confirmed', 'completed', 'cancelled'] as const).includes(booking.status as BookingStatus) 
          ? booking.status as BookingStatus 
          : 'pending';

        return {
          id: booking.id,
          title: `${serviceName} - ${customerName} (${workerName})`,
          start: startDateTime,
          end: endDateTime,
          status: validStatus,
          worker: booking.worker,
          customer: booking.customer,
          service: booking.service,
          resource: booking
        };
      });

      setEvents(transformedEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      toast({
        title: "Error",
        description: "Failed to load calendar events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#3174ad';
    
    switch (event.status) {
      case 'pending':
        backgroundColor = '#f59e0b';
        break;
      case 'confirmed':
        backgroundColor = '#10b981';
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

  const handleEventSelect = (event: CalendarEvent) => {
    const statusColor = {
      pending: 'yellow',
      confirmed: 'green',
      completed: 'gray',
      cancelled: 'red'
    }[event.status] || 'blue';

    toast({
      title: `${event.service?.name || 'Service'}`,
      description: (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={`text-${statusColor}-600`}>
              {event.status}
            </Badge>
          </div>
          <div><strong>Customer:</strong> {event.customer?.name}</div>
          <div><strong>Worker:</strong> {event.worker?.name || 'Unassigned'}</div>
          <div><strong>Location:</strong> {event.customer?.city}</div>
          <div><strong>Time:</strong> {format(event.start, 'PPp')}</div>
        </div>
      ),
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5" />
            <span>Admin Calendar View</span>
            {isConnected && (
              <Badge variant="outline" className="text-green-600">
                ● Live
              </Badge>
            )}
          </CardTitle>
          <Button
            onClick={forceRefresh}
            disabled={isRefreshing}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading calendar...</span>
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
              views={['month', 'week', 'day']}
              defaultView="week"
              popup
            />
          </div>
        )}
        
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-yellow-500">Pending</Badge>
          <Badge className="bg-green-500">Confirmed</Badge>
          <Badge className="bg-gray-500">Completed</Badge>
          <Badge className="bg-red-500">Cancelled</Badge>
        </div>
      </CardContent>
    </Card>
  );
};
