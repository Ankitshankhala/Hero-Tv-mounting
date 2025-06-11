
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

      // Filter by region through worker's region
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
      const slotEnd = new Date(slotTime.getTime() + 60 * 60000); // 1 hour slot
      
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

  const formatServices = (services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => s.name).join(', ');
    }
    return 'Service';
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

  const isSelected = (date: Date, time: string) => {
    if (!selectedDate || !selectedTime) return false;
    const dateStr = date.toISOString().split('T')[0];
    return dateStr === selectedDate && time === selectedTime;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Choose Your Appointment Time</h2>
        <p className="text-slate-300">Select from available time slots. Red blocks show existing bookings in your area.</p>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Available Time Slots</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
                className="text-white border-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-white font-medium">
                {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
                className="text-white border-slate-600"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
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
                      <div
                        key={`${dayIndex}-${time}`}
                        className={`
                          min-h-16 border border-slate-700 p-1 cursor-pointer transition-colors
                          ${isSelectedSlot ? 'bg-blue-600 border-blue-500' : ''}
                          ${!isAvailable ? 'bg-slate-700' : 'hover:bg-slate-600'}
                          ${isAvailable && !isSelectedSlot ? 'bg-slate-800' : ''}
                        `}
                        onClick={() => handleTimeSlotClick(day, time)}
                      >
                        {dayBookings.map((booking, bookingIndex) => (
                          <div
                            key={`${booking.id}-${bookingIndex}`}
                            className="bg-red-600 text-white text-xs p-1 rounded mb-1 opacity-75"
                          >
                            <div className="flex items-center space-x-1">
                              <User className="h-3 w-3" />
                              <span className="truncate">
                                {booking.worker?.name || 'Worker'}
                              </span>
                            </div>
                            <div className="truncate">
                              {formatServices(booking.services)}
                            </div>
                          </div>
                        ))}
                        {isAvailable && dayBookings.length === 0 && (
                          <div className="text-green-400 text-xs p-1">
                            Available
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}

          <div className="mt-4 flex space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-600 rounded"></div>
              <span className="text-slate-300">Available</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-600 rounded"></div>
              <span className="text-slate-300">Booked</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span className="text-slate-300">Selected</span>
            </div>
          </div>
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
