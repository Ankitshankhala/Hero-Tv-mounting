
import React from 'react';
import BookingCalendarSync from '@/components/BookingCalendarSync';

interface Booking {
  id: string;
  services: any;
  scheduled_at: string;
  customer_address: string;
  worker?: { name?: string };
  status: string;
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
      {bookings.map((booking) => (
        <BookingCalendarSync
          key={booking.id}
          booking={{
            id: booking.id,
            service: `${formatServices(booking.services)} - Admin View`,
            date: new Date(booking.scheduled_at).toISOString().split('T')[0],
            time: new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            address: booking.customer_address,
            worker: booking.worker?.name || 'Unassigned',
            status: booking.status
          }}
          action="create"
          onEventCreated={(eventId) => {
            if (process.env.NODE_ENV === 'development') {
              console.log(`Admin calendar event created for booking ${booking.id}: ${eventId}`);
            }
          }}
        />
      ))}
    </>
  );
};
