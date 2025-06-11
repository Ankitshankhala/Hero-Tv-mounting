
import React from 'react';
import { BookingBlock } from './BookingBlock';

interface Booking {
  id: string;
  scheduled_at: string;
  total_duration_minutes: number;
  services: any;
  worker: { name: string } | null;
}

interface TimeSlotProps {
  day: Date;
  time: string;
  bookings: Booking[];
  isAvailable: boolean;
  isSelected: boolean;
  onTimeSlotClick: (date: Date, time: string) => void;
}

export const TimeSlot = ({
  day,
  time,
  bookings,
  isAvailable,
  isSelected,
  onTimeSlotClick
}: TimeSlotProps) => {
  return (
    <div
      className={`
        min-h-16 border border-slate-700 p-1 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-600 border-blue-500' : ''}
        ${!isAvailable ? 'bg-slate-700' : 'hover:bg-slate-600'}
        ${isAvailable && !isSelected ? 'bg-slate-800' : ''}
      `}
      onClick={() => onTimeSlotClick(day, time)}
    >
      {bookings.map((booking, bookingIndex) => (
        <BookingBlock
          key={`${booking.id}-${bookingIndex}`}
          booking={booking}
        />
      ))}
      {isAvailable && bookings.length === 0 && (
        <div className="text-green-400 text-xs p-1">
          Available
        </div>
      )}
    </div>
  );
};
