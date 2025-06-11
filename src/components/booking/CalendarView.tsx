
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarHeader } from './calendar/CalendarHeader';
import { WeekGrid } from './calendar/WeekGrid';
import { CalendarLegend } from './calendar/CalendarLegend';

interface CalendarViewProps {
  selectedRegion: string;
  selectedDate?: string;
  selectedTime?: string;
  onDateTimeSelect: (date: string, time: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

interface Booking {
  id: string;
  scheduled_at: string;
  total_duration_minutes: number;
  services: any;
  worker: { name: string } | null;
}

export const CalendarView = ({ 
  selectedRegion, 
  selectedDate, 
  selectedTime, 
  onDateTimeSelect,
  onBack,
  onContinue
}: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const timeSlots = Array.from({ length: 9 }, (_, i) => {
    const hour = 9 + i;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const daysInWeek = 7;
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  const weekDays = Array.from({ length: daysInWeek }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });

  const fetchBookings = async () => {
    if (!selectedRegion) return;

    setLoading(true);
    try {
      const startDate = weekDays[0].toISOString().split('T')[0];
      const endDate = weekDays[6].toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          scheduled_at,
          total_duration_minutes,
          services,
          worker:users!worker_id(name)
        `)
        .gte('scheduled_at', `${startDate}T00:00:00`)
        .lte('scheduled_at', `${endDate}T23:59:59`)
        .in('status', ['confirmed', 'in_progress'])
        .not('worker_id', 'is', null);

      if (error) throw error;

      const regionBookings = data?.filter(booking => 
        booking.worker && selectedRegion
      ) || [];

      setBookings(regionBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load existing bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [currentDate, selectedRegion]);

  const getBookingsForDateTime = (date: Date, time: string) => {
    const dateStr = date.toISOString().split('T')[0];
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.scheduled_at);
      const bookingDateStr = bookingDate.toISOString().split('T')[0];
      const bookingTime = bookingDate.toTimeString().slice(0, 5);
      
      if (dateStr !== bookingDateStr) return false;
      
      const bookingStart = new Date(`2000-01-01T${bookingTime}`);
      const bookingEnd = new Date(bookingStart.getTime() + booking.total_duration_minutes * 60000);
      const slotTime = new Date(`2000-01-01T${time}`);
      const slotEnd = new Date(slotTime.getTime() + 60 * 60000);
      
      return (slotTime < bookingEnd && slotEnd > bookingStart);
    });
  };

  const isTimeSlotAvailable = (date: Date, time: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) return false;
    
    const conflictingBookings = getBookingsForDateTime(date, time);
    return conflictingBookings.length === 0;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const handleTimeSlotClick = (date: Date, time: string) => {
    if (!isTimeSlotAvailable(date, time)) return;
    
    const dateStr = date.toISOString().split('T')[0];
    onDateTimeSelect(dateStr, time);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Choose Your Appointment Time</h2>
        <p className="text-slate-300">Select from available time slots. Red blocks show existing bookings in your area.</p>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CalendarHeader weekDays={weekDays} onNavigateWeek={navigateWeek} />
        
        <CardContent>
          {!selectedRegion ? (
            <div className="text-slate-400 text-center py-8">
              Please select a region first
            </div>
          ) : loading ? (
            <div className="text-slate-400 text-center py-8">
              Loading calendar...
            </div>
          ) : (
            <WeekGrid
              weekDays={weekDays}
              timeSlots={timeSlots}
              bookings={bookings}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onTimeSlotClick={handleTimeSlotClick}
              getBookingsForDateTime={getBookingsForDateTime}
              isTimeSlotAvailable={isTimeSlotAvailable}
            />
          )}

          <CalendarLegend />
        </CardContent>
      </Card>

      <div className="mt-8 flex space-x-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button 
          onClick={onContinue} 
          className="flex-1"
          disabled={!selectedDate || !selectedTime}
        >
          Continue to Details
        </Button>
      </div>
    </div>
  );
};
