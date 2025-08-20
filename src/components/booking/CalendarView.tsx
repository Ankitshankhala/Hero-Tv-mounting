
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { CalendarHeader } from './calendar/CalendarHeader';
import { WeekGrid } from './calendar/WeekGrid';
import { CalendarLegend } from './calendar/CalendarLegend';
import { toZonedTime } from 'date-fns-tz';

interface CalendarViewProps {
  selectedRegion: string;
  selectedDate?: string;
  selectedTime?: string;
  onDateTimeSelect: (date: string, time: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

interface CalendarBooking {
  id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes: string | null;
  users: { name: string } | null;
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
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { isConnected, isRefreshing, forceRefresh } = useCalendarSync({
    userRole: 'customer',
    onBookingUpdate: () => {
      fetchBookings();
    }
  });

  const timeSlots = Array.from({ length: 12 }, (_, i) => {
    const hour = 8 + i;
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
          scheduled_date,
          scheduled_start,
          location_notes,
          users!worker_id(name)
        `)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .in('status', ['confirmed', 'completed'])
        .not('worker_id', 'is', null);

      if (error) throw error;

      const regionBookings = data?.filter(booking => 
        booking.users && selectedRegion
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
      const bookingDateStr = booking.scheduled_date;
      const bookingTime = booking.scheduled_start.slice(0, 5);
      
      if (dateStr !== bookingDateStr) return false;
      
      const bookingStart = new Date(`2000-01-01T${bookingTime}`);
      const bookingEnd = new Date(bookingStart.getTime() + 60 * 60000);
      const slotTime = new Date(`2000-01-01T${time}`);
      const slotEnd = new Date(slotTime.getTime() + 60 * 60000);
      
      return (slotTime < bookingEnd && slotEnd > bookingStart);
    });
  };

  const isTimeSlotAvailable = (date: Date, time: string) => {
    // Get current time in America/Chicago timezone
    const nowInChicago = toZonedTime(new Date(), 'America/Chicago');
    const todayInChicago = new Date(nowInChicago.getFullYear(), nowInChicago.getMonth(), nowInChicago.getDate());
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Don't allow past dates
    if (dateOnly < todayInChicago) return false;
    
    // For same-day booking, check if the time slot is at least 30 minutes from now
    if (dateOnly.getTime() === todayInChicago.getTime()) {
      const [hours] = time.split(':').map(Number);
      const currentHour = nowInChicago.getHours();
      const currentMinutes = nowInChicago.getMinutes();
      const slotMinutes = hours * 60;
      const nowMinutes = currentHour * 60 + currentMinutes;
      
      // Require at least 30 minutes advance notice for same-day bookings
      if (slotMinutes <= nowMinutes + 30) return false;
    }
    
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
        <div className="flex items-center justify-center space-x-4">
          <h2 className="text-3xl font-bold text-white">Choose Your Appointment Time</h2>
          {isConnected && (
            <Badge variant="outline" className="text-green-400 border-green-400">
              ● Live Updates
            </Badge>
          )}
          <Button
            onClick={forceRefresh}
            disabled={isRefreshing}
            size="sm"
            variant="outline"
            className="text-white border-white"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="text-slate-300 mt-2">
          Select from available time slots. Same-day booking available with 30-minute advance notice.
        </p>
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
