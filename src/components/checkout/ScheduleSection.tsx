import React from 'react';
import { CalendarIcon, Clock, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTimeTo12Hour } from '@/utils/timeUtils';

interface ScheduleSectionProps {
  selectedDate: Date | undefined;
  formData: {
    zipcode: string;
    time: string;
  };
  workerCount: number;
  loading: boolean;
  timeSlots: string[];
  blockedSlots: string[];
  onDateSelect: (date: Date | undefined) => void;
  onTimeSelect: (time: string) => void;
}

export const ScheduleSection = ({
  selectedDate,
  formData,
  workerCount,
  loading,
  timeSlots,
  blockedSlots,
  onDateSelect,
  onTimeSelect
}: ScheduleSectionProps) => {
  // Get current time to filter out past time slots for today
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  // Filter time slots for same day booking - only show slots after current time + 30 minute buffer
  const getAvailableTimeSlots = () => {
    if (!selectedDate) return timeSlots;
    
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const isToday = selectedDateOnly.getTime() === today.getTime();
    
    if (!isToday) return timeSlots;
    
    // For same day booking, only show time slots that are at least 30 minutes from now
    return timeSlots.filter(time => {
      const [hours] = time.split(':').map(Number);
      const slotMinutes = hours * 60;
      const nowMinutes = currentHour * 60 + currentMinutes;
      return slotMinutes > nowMinutes + 30;
    });
  };

  const availableTimeSlots = getAvailableTimeSlots();

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-purple-800 flex items-center">
          <CalendarIcon className="h-5 w-5 text-purple-600 mr-2" />
          Schedule Your Service
        </h3>
        {workerCount > 0 && (
          <div className="flex items-center space-x-2 text-sm bg-purple-100 text-purple-700 px-4 py-2 rounded-full">
            <Users className="h-4 w-4" />
            <span>{workerCount} workers available</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calendar Section */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <CalendarIcon className="h-4 w-4 text-purple-600" />
            <span>Select Date</span>
            <span className="text-red-500">*</span>
          </Label>
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                onDateSelect(date);
              }}
              disabled={(date) => {
                // Allow today and future dates, disable past dates
                const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                return dateOnly < today;
              }}
              className="w-full"
            />
          </div>
        </div>

        {/* Time Slots Section */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <Clock className="h-4 w-4 text-purple-600" />
            <span>Available Time Slots</span>
            <span className="text-red-500">*</span>
          </Label>
          
          <div className="border border-gray-200 rounded-lg bg-white p-4">
            {!selectedDate ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p>Please select a date first</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
                <p className="text-gray-500">Loading availability...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Available</span>
                    <div className="w-3 h-3 bg-red-500 rounded-full ml-4"></div>
                    <span>Booked</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Times shown are based on worker availability in your area (ZIP: {formData.zipcode})
                    {selectedDate && selectedDate.toDateString() === today.toDateString() && 
                      " • Same-day booking available! (30 min advance notice)"
                    }
                  </p>
                </div>
                
                {availableTimeSlots.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p>No time slots available for this date</p>
                    {selectedDate && selectedDate.toDateString() === today.toDateString() && (
                      <p className="text-sm text-orange-600 mt-2">
                        For same-day service, please allow at least 30 minutes advance notice
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {availableTimeSlots.map((time) => {
                      const isBlocked = blockedSlots.includes(time);
                      const isSelected = formData.time === time;
                      
                      // PHASE 3: Show worker count for available slots
                      const slotWorkerCount = !isBlocked && timeSlots.includes(time) ? workerCount : 0;
                      
                      return (
                        <Button
                          key={time}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          disabled={isBlocked}
                          onClick={() => onTimeSelect(time)}
                          className={cn(
                            "h-12 text-sm font-medium transition-all duration-200 relative",
                            isBlocked && "bg-red-50 text-red-600 border-red-200 cursor-not-allowed hover:bg-red-50",
                            isSelected && "bg-purple-600 text-white border-purple-600 shadow-md",
                            !isBlocked && !isSelected && "hover:bg-purple-50 hover:border-purple-300 bg-white border-gray-200"
                          )}
                        >
                          <div className="flex flex-col items-center space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                isBlocked ? "bg-red-500" : "bg-green-500"
                              )} />
                              <span className={isSelected ? "text-white" : 'text-black'}>{formatTimeTo12Hour(time)}</span>
                            </div>
                            {!isBlocked && slotWorkerCount > 0 && (
                              <span className={cn(
                                "text-[10px]",
                                isSelected ? "text-purple-100" : "text-gray-500"
                              )}>
                                {slotWorkerCount} {slotWorkerCount === 1 ? 'worker' : 'workers'}
                              </span>
                            )}
                          </div>
                          {isBlocked && (
                            <div className="absolute inset-0 bg-red-100/50 rounded flex items-center justify-center">
                              <span className="text-xs font-medium text-red-700">Busy</span>
                            </div>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
