
import { useCallback } from 'react';
import { useGoogleCalendar } from './useGoogleCalendar';

interface BookingData {
  id: string;
  services: any;
  scheduled_at: string;
  customer_address: string;
  worker?: { name?: string };
  status: string;
  google_calendar_event_id?: string;
}

export const useBookingCalendarSync = () => {
  const { isConnected, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useGoogleCalendar();

  const formatServices = useCallback((services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => s.name).join(', ');
    }
    return 'Service';
  }, []);

  const syncBookingToCalendar = useCallback(async (
    booking: BookingData,
    action: 'create' | 'update' | 'delete'
  ) => {
    if (!isConnected) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Calendar not connected, skipping sync');
      }
      return null;
    }

    try {
      const startDateTime = new Date(booking.scheduled_at);
      const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // 2 hour duration

      const calendarEvent = {
        summary: `${formatServices(booking.services)} - Service Appointment`,
        description: `
Booking ID: ${booking.id}
Service: ${formatServices(booking.services)}
${booking.worker?.name ? `Technician: ${booking.worker.name}` : 'Technician: To be assigned'}
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
        location: booking.customer_address
      };

      switch (action) {
        case 'create':
          const createdEvent = await createCalendarEvent(calendarEvent);
          if (process.env.NODE_ENV === 'development') {
            console.log(`Calendar event created for booking ${booking.id}: ${createdEvent?.id}`);
          }
          return createdEvent?.id || null;
        
        case 'update':
          if (booking.google_calendar_event_id) {
            const updatedEvent = await updateCalendarEvent(booking.google_calendar_event_id, calendarEvent);
            if (process.env.NODE_ENV === 'development') {
              console.log(`Calendar event updated for booking ${booking.id}: ${booking.google_calendar_event_id}`);
            }
            return booking.google_calendar_event_id;
          }
          break;
        
        case 'delete':
          if (booking.google_calendar_event_id) {
            const success = await deleteCalendarEvent(booking.google_calendar_event_id);
            if (process.env.NODE_ENV === 'development') {
              console.log(`Calendar event deleted for booking ${booking.id}: ${booking.google_calendar_event_id}`);
            }
            return success ? null : booking.google_calendar_event_id;
          }
          break;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error syncing booking to calendar:', error);
      }
    }

    return null;
  }, [isConnected, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, formatServices]);

  return { syncBookingToCalendar, isCalendarConnected: isConnected };
};
