
import React from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
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

interface CalendarContentProps {
  jobs: Job[];
}

export const CalendarContent = ({ jobs }: CalendarContentProps) => {
  const { toast } = useToast();

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

  return (
    <div className="h-96 bg-white p-4 rounded-lg border">
      <Calendar
        localizer={localizer}
        events={jobs}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        eventPropGetter={eventStyleGetter}
        views={['month', 'week', 'day']}
        defaultView="week"
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
