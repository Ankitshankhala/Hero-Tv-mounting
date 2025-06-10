
import React from 'react';
import BookingCalendarSync from '@/components/BookingCalendarSync';

interface Booking {
  id: string;
  services: any;
  scheduled_at: string;
  customer_address: string;
  worker?: { name?: string };
  status: string;
  google_calendar_event_id?: string;
}

interface BookingCalendarSyncListProps {
  bookings: Booking[];
  isCalendarConnected: boolean;
}

export const BookingCalendarSyncList = ({ bookings, isCalendarConnected }: BookingCalendarSyncListProps) => {
  const formatServices = (services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => s.name).join(', ');
    }
    return 'N/A';
  };

  if (!isCalendarConnected) {
    return null;
  }

  return (
    <>
      {bookings.map((booking) => {
        // Determine the action based on booking state
        let action: 'create' | 'update' | 'delete' = 'create';
        
        if (booking.status === 'cancelled') {
          action = 'delete';
        } else if (booking.google_calendar_event_id) {
          action = 'update';
        }

        return (
          <BookingCalendarSync
            key={`${booking.id}-${booking.status}-${new Date(booking.scheduled_at).getTime()}`}
            booking={{
              id: booking.id,
              service: `${formatServices(booking.services)} - Admin View`,
              date: new Date(booking.scheduled_at).toISOString().split('T')[0],
              time: new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              address: booking.customer_address,
              worker: booking.worker?.name || 'Unassigned',
              status: booking.status
            }}
            action={action}
            googleCalendarEventId={booking.google_calendar_event_id}
            onEventCreated={(eventId) => {
              if (process.env.NODE_ENV === 'development') {
                console.log(`Admin calendar event created for booking ${booking.id}: ${eventId}`);
              }
              // TODO: Store the calendar event ID in the database for future updates
            }}
            onEventUpdated={(eventId) => {
              if (process.env.NODE_ENV === 'development') {
                console.log(`Admin calendar event updated for booking ${booking.id}: ${eventId}`);
              }
            }}
            onEventDeleted={() => {
              if (process.env.NODE_ENV === 'development') {
                console.log(`Admin calendar event deleted for booking ${booking.id}`);
              }
            }}
          />
        );
      })}
    </>
  );
};
