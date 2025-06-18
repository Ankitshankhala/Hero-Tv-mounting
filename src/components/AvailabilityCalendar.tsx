
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AvailabilityCalendarProps {
  selectedRegion: string;
  selectedServices: Array<{
    id: string;
    name: string;
    duration_minutes: number;
  }>;
  onDateTimeSelect: (date: string, time: string) => void;
  selectedDate?: string;
  selectedTime?: string;
}

interface TimeSlot {
  time: string;
  availableWorkers: number;
  isAvailable: boolean;
}

export const AvailabilityCalendar = ({
  selectedRegion,
  selectedServices,
  onDateTimeSelect,
  selectedDate,
  selectedTime
}: AvailabilityCalendarProps) => {
  const [date, setDate] = useState<Date>(selectedDate ? new Date(selectedDate) : new Date());
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const totalDuration = selectedServices.reduce((total, service) => total + service.duration_minutes, 0);

  const fetchAvailableSlots = useCallback(async (selectedDate: Date) => {
    if (!selectedRegion || selectedServices.length === 0) {
      setAvailableSlots([]);
      return;
    }

    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      // Get worker schedules for the selected date
      const { data: schedules, error: schedulesError } = await supabase
        .from('worker_schedule')
        .select(`
          *,
          users!worker_id (
            id,
            name,
            city
          )
        `)
        .eq('work_date', dateStr);

      if (schedulesError) throw schedulesError;

      // Filter by region (using city as region for now)
      const regionSchedules = schedules?.filter(schedule => 
        schedule.users?.city?.toLowerCase() === selectedRegion.toLowerCase()
      ) || [];

      // Get existing bookings for the date
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('scheduled_date, scheduled_start, worker_id')
        .eq('scheduled_date', dateStr)
        .in('status', ['confirmed', 'pending']);

      if (bookingsError) throw bookingsError;

      // Generate time slots (9 AM to 5 PM, every hour)
      const slots: TimeSlot[] = [];
      for (let hour = 9; hour <= 17; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00:00`;
        const slotTime = new Date(`${dateStr}T${timeStr}`);
        
        // Check how many workers are available for this time slot
        let availableWorkers = 0;

        regionSchedules.forEach(schedule => {
          const startTime = new Date(`${dateStr}T${schedule.start_time}`);
          const endTime = new Date(`${dateStr}T${schedule.end_time}`);
          const slotEndTime = new Date(slotTime.getTime() + totalDuration * 60000);

          // Check if the slot fits within worker's schedule
          if (slotTime >= startTime && slotEndTime <= endTime) {
            // Check if worker has conflicting bookings
            const hasConflict = bookings?.some(booking => {
              if (booking.worker_id !== schedule.worker_id) return false;
              
              const bookingStart = new Date(`${booking.scheduled_date}T${booking.scheduled_start}`);
              const bookingEnd = new Date(bookingStart.getTime() + totalDuration * 60000);
              
              return (slotTime < bookingEnd && slotEndTime > bookingStart);
            });

            if (!hasConflict) {
              availableWorkers++;
            }
          }
        });

        slots.push({
          time: timeStr.substring(0, 5), // Remove seconds
          availableWorkers,
          isAvailable: availableWorkers > 0
        });
      }

      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error fetching availability:', error);
      toast({
        title: "Error",
        description: "Failed to load availability",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedRegion, selectedServices, totalDuration, toast]);

  useEffect(() => {
    fetchAvailableSlots(date);
  }, [date, fetchAvailableSlots]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleTimeSelect = (time: string) => {
    const dateStr = date.toISOString().split('T')[0];
    onDateTimeSelect(dateStr, time);
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Select Date & Time</span>
          </CardTitle>
          {selectedRegion && (
            <div className="flex items-center space-x-2 text-slate-300">
              <MapPin className="h-4 w-4" />
              <span>Region: {selectedRegion}</span>
            </div>
          )}
          {totalDuration > 0 && (
            <div className="text-slate-300 text-sm">
              Estimated duration: {Math.ceil(totalDuration / 60)} hours
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendar */}
            <div>
              <h3 className="text-white font-medium mb-4">Choose Date</h3>
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                className="rounded-md border border-slate-600 bg-slate-700"
                classNames={{
                  months: "flex flex-col space-y-4 w-full",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center text-white",
                  caption_label: "text-sm font-medium text-white",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-slate-500 rounded text-white hover:bg-slate-600",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell: "text-slate-400 rounded-md flex-1 font-normal text-[0.8rem] text-center p-0 min-w-0",
                  row: "flex w-full mt-1",
                  cell: "text-center text-sm p-0 relative flex-1 min-w-0",
                  day: "h-9 w-full p-0 font-normal hover:bg-slate-600 rounded-md transition-colors mx-auto flex items-center justify-center text-white",
                  day_selected: "bg-blue-600 text-white hover:bg-blue-700",
                  day_today: "bg-slate-600 text-white font-semibold",
                  day_outside: "text-slate-500 opacity-50",
                  day_disabled: "text-slate-600 opacity-30 cursor-not-allowed",
                }}
              />
            </div>

            {/* Time Slots */}
            <div>
              <h3 className="text-white font-medium mb-4">Available Times</h3>
              {!selectedRegion || selectedServices.length === 0 ? (
                <div className="text-slate-400 text-center py-8">
                  Please select services and region first
                </div>
              ) : loading ? (
                <div className="text-slate-400 text-center py-8">
                  Loading availability...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      disabled={!slot.isAvailable}
                      onClick={() => handleTimeSelect(slot.time)}
                      className={`
                        relative p-3 h-auto flex flex-col items-center space-y-1
                        ${slot.isAvailable 
                          ? 'border-slate-600 text-white hover:bg-slate-600' 
                          : 'border-slate-700 text-slate-500 bg-slate-800'
                        }
                        ${selectedTime === slot.time ? 'bg-blue-600 border-blue-600' : ''}
                      `}
                    >
                      <span className="font-medium">
                        {new Date(`2000-01-01T${slot.time}`).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {slot.isAvailable && (
                        <div className="flex items-center space-x-1 text-xs">
                          <Users className="h-3 w-3" />
                          <span>{slot.availableWorkers} available</span>
                        </div>
                      )}
                      {!slot.isAvailable && (
                        <Badge variant="secondary" className="text-xs">
                          Unavailable
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedDate && selectedTime && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Selected Appointment</h4>
              <div className="text-blue-200">
                <p>{new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
                <p>at {new Date(`2000-01-01T${selectedTime}`).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AvailabilityCalendar;
