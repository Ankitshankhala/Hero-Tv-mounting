
import React from 'react';
import { cn } from '@/lib/utils';

interface CalendarBooking {
  id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes: string | null;
  users: { name: string } | null;
}

interface TimeSlotProps {
  day: Date;
  time: string;
  bookings: CalendarBooking[];
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
  const hasBookings = bookings.length > 0;
  
  // Check if this is today and if the time slot is in the past
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOnly = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const isToday = dayOnly.getTime() === today.getTime();
  
  let isPastTimeSlot = false;
  if (isToday) {
    const [hours] = time.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const slotMinutes = hours * 60;
    const nowMinutes = currentHour * 60 + currentMinutes;
    
    // Consider slots that are less than 30 minutes away as past slots
    isPastTimeSlot = slotMinutes <= nowMinutes + 30;
  }
  
  // Determine if slot should be disabled
  const isDisabled = hasBookings || isPastTimeSlot || !isAvailable;

  return (
    <div
      className={cn(
        "h-12 border border-slate-600/30 cursor-pointer transition-all duration-200 flex items-center justify-center text-xs relative",
        isSelected && "bg-blue-600 border-blue-500 text-white shadow-lg",
        !isSelected && !isDisabled && "hover:bg-slate-700/50 bg-slate-800/30",
        isDisabled && "bg-slate-700/20 cursor-not-allowed opacity-50",
        hasBookings && "bg-red-900/30 border-red-500/50",
        isPastTimeSlot && !hasBookings && "bg-gray-600/30 border-gray-500/50"
      )}
      onClick={() => {
        if (!isDisabled) {
          onTimeSlotClick(day, time);
        }
      }}
    >
      {hasBookings ? (
        <div className="text-center">
          <div className="text-red-300 font-medium">Booked</div>
          {bookings[0]?.users?.name && (
            <div className="text-red-200 text-xs truncate max-w-16">
              {bookings[0].users.name}
            </div>
          )}
        </div>
      ) : isPastTimeSlot ? (
        <div className="text-gray-400 text-xs">Past</div>
      ) : isSelected ? (
        <div className="text-white font-medium">Selected</div>
      ) : (
        <div className="text-slate-300">Available</div>
      )}
    </div>
  );
};
