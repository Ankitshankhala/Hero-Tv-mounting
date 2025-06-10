
import React, { useEffect } from 'react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useToast } from '@/hooks/use-toast';

interface BookingCalendarSyncProps {
  booking: {
    id: string;
    service: string;
    date: string;
    time: string;
    address: string;
    worker?: string;
    status: string;
  };
  action: 'create' | 'update' | 'delete';
  googleCalendarEventId?: string;
  onEventCreated?: (eventId: string) => void;
}

const BookingCalendarSync = ({ 
  booking, 
  action, 
  googleCalendarEventId,
  onEventCreated 
}: BookingCalendarSyncProps) => {
  const { isConnected, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useGoogleCalendar();
  const { toast } = useToast();

  useEffect(() => {
    if (!isConnected) return;

    const syncToCalendar = async () => {
      const startDateTime = new Date(`${booking.date} ${booking.time}`);
      const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // Assume 2 hour duration

      const calendarEvent = {
        summary: `${booking.service} - Service Appointment`,
        description: `
Booking ID: ${booking.id}
Service: ${booking.service}
${booking.worker ? `Technician: ${booking.worker}` : 'Technician: To be assigned'}
Status: ${booking.status}

This is an automated booking from your service management system.
        `.trim(),
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        location: booking.address
      };

      try {
        switch (action) {
          case 'create':
            const createdEvent = await createCalendarEvent(calendarEvent);
            if (createdEvent && onEventCreated) {
              onEventCreated(createdEvent.id);
            }
            break;
          
          case 'update':
            if (googleCalendarEventId) {
              await updateCalendarEvent(googleCalendarEventId, calendarEvent);
            }
            break;
          
          case 'delete':
            if (googleCalendarEventId) {
              await deleteCalendarEvent(googleCalendarEventId);
            }
            break;
        }
      } catch (error) {
        console.error('Error syncing to calendar:', error);
      }
    };

    syncToCalendar();
  }, [
    isConnected, 
    booking, 
    action, 
    googleCalendarEventId, 
    createCalendarEvent, 
    updateCalendarEvent, 
    deleteCalendarEvent, 
    onEventCreated
  ]);

  return null; // This is a utility component with no UI
};

export default BookingCalendarSync;
