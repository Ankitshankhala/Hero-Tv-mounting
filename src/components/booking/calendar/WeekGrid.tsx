
import React from 'react';
import { TimeSlot } from './TimeSlot';

interface CalendarBooking {
  id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes: string | null;
  users: { name: string } | null;
}

interface WeekGridProps {
  weekDays: Date[];
  timeSlots: string[];
  bookings: CalendarBooking[];
  selectedDate?: string;
  selectedTime?: string;
  onTimeSlotClick: (date: Date, time: string) => void;
  getBookingsForDateTime: (date: Date, time: string) => CalendarBooking[];
  isTimeSlotAvailable: (date: Date, time: string) => boolean;
}

export const WeekGrid = ({
  weekDays,
  timeSlots,
  selectedDate,
  selectedTime,
  onTimeSlotClick,
  getBookingsForDateTime,
  isTimeSlotAvailable
}: WeekGridProps) => {
  const isSelected = (date: Date, time: string) => {
    if (!selectedDate || !selectedTime) return false;
    const dateStr = date.toISOString().split('T')[0];
    return dateStr === selectedDate && time === selectedTime;
  };

  return (
    <div className="grid grid-cols-8 gap-1">
      {/* Time column header */}
      <div className="text-slate-400 text-sm font-medium p-2"></div>
      
      {/* Day headers */}
      {weekDays.map((day, index) => (
        <div key={index} className="text-center p-2">
          <div className="text-slate-400 text-sm">
            {day.toLocaleDateString('en-US', { weekday: 'short' })}
          </div>
          <div className="text-white font-medium">
            {day.getDate()}
          </div>
        </div>
      ))}

      {/* Time slots */}
      {timeSlots.map((time) => (
        <React.Fragment key={time}>
          {/* Time label */}
          <div className="text-slate-400 text-sm p-2 text-right">
            {new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayBookings = getBookingsForDateTime(day, time);
            const isAvailable = isTimeSlotAvailable(day, time);
            const isSelectedSlot = isSelected(day, time);

            return (
              <TimeSlot
                key={`${dayIndex}-${time}`}
                day={day}
                time={time}
                bookings={dayBookings}
                isAvailable={isAvailable}
                isSelected={isSelectedSlot}
                onTimeSlotClick={onTimeSlotClick}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
