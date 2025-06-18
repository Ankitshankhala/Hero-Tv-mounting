
import React from 'react';
import { User } from 'lucide-react';

interface CalendarBooking {
  id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes: string | null;
  users: { name: string } | null;
}

interface BookingBlockProps {
  booking: CalendarBooking;
}

export const BookingBlock = ({ booking }: BookingBlockProps) => {
  return (
    <div className="bg-red-600 text-white text-xs p-1 rounded mb-1 opacity-75">
      <div className="flex items-center space-x-1">
        <User className="h-3 w-3" />
        <span className="truncate">
          {booking.users?.name || 'Worker'}
        </span>
      </div>
      <div className="truncate">
        Service Booking
      </div>
    </div>
  );
};
