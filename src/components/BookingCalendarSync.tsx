
import React, { useEffect, useState } from 'react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

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
  onEventUpdated?: (eventId: string) => void;
  onEventDeleted?: () => void;
}

const BookingCalendarSync = ({ 
  booking, 
  action, 
  googleCalendarEventId,
  onEventCreated,
  onEventUpdated,
  onEventDeleted
}: BookingCalendarSyncProps) => {
  const { isConnected, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useGoogleCalendar();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedBooking, setLastSyncedBooking] = useState<string>('');

  useEffect(() => {
    if (!isConnected || isSyncing) return;

    // Create a unique key for this booking state to prevent duplicate syncs
    const bookingStateKey = `${booking.id}-${booking.status}-${booking.date}-${booking.time}-${action}`;
    
    // Skip if we already synced this exact state
    if (lastSyncedBooking === bookingStateKey) return;

    const syncToCalendar = async () => {
      setIsSyncing(true);
      
      try {
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

        switch (action) {
          case 'create':
            const createdEvent = await createCalendarEvent(calendarEvent);
            if (createdEvent && onEventCreated) {
              onEventCreated(createdEvent.id);
            }
            if (process.env.NODE_ENV === 'development') {
              console.log(`Calendar event created for booking ${booking.id}: ${createdEvent?.id}`);
            }
            break;
          
          case 'update':
            if (googleCalendarEventId) {
              const updatedEvent = await updateCalendarEvent(googleCalendarEventId, calendarEvent);
              if (updatedEvent && onEventUpdated) {
                onEventUpdated(updatedEvent.id);
              }
              if (process.env.NODE_ENV === 'development') {
                console.log(`Calendar event updated for booking ${booking.id}: ${googleCalendarEventId}`);
              }
            }
            break;
          
          case 'delete':
            if (googleCalendarEventId) {
              const success = await deleteCalendarEvent(googleCalendarEventId);
              if (success && onEventDeleted) {
                onEventDeleted();
              }
              if (process.env.NODE_ENV === 'development') {
                console.log(`Calendar event deleted for booking ${booking.id}: ${googleCalendarEventId}`);
              }
            }
            break;
        }

        setLastSyncedBooking(bookingStateKey);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error syncing to calendar:', error);
        }
      } finally {
        setIsSyncing(false);
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
    onEventCreated,
    onEventUpdated,
    onEventDeleted,
    isSyncing,
    lastSyncedBooking
  ]);

  return null; // This is a utility component with no UI
};

export default BookingCalendarSync;
