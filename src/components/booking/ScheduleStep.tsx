
import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormData {
  selectedDate: Date | undefined;
  selectedTime: string;
  zipcode: string;
}

interface ScheduleStepProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  timeSlots: string[];
  blockedSlots: string[];
  workerCount: number;
  loading: boolean;
}

export const ScheduleStep = ({
  formData,
  setFormData,
  timeSlots,
  blockedSlots,
  workerCount,
  loading
}: ScheduleStepProps) => {
  // Get current time to filter out past time slots for today
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  // Filter time slots for same day booking - only show slots after current time + 30 minute buffer
  const getAvailableTimeSlots = () => {
    if (!formData.selectedDate) return timeSlots;
    
    const selectedDateOnly = new Date(formData.selectedDate.getFullYear(), formData.selectedDate.getMonth(), formData.selectedDate.getDate());
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
  const filteredAvailableSlots = availableTimeSlots.filter(slot => !blockedSlots.includes(slot));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Schedule Your Service</h3>
        <p className="text-slate-300">Choose your preferred date and time</p>
        {workerCount > 0 && (
          <div className="inline-flex items-center space-x-2 text-sm bg-green-900/30 text-green-300 px-3 py-1 rounded-full mt-2 border border-green-500/30">
            <Users className="h-4 w-4" />
            <span>{workerCount} workers available in your area</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Label className="text-base font-medium flex items-center space-x-2 text-white">
            <CalendarIcon className="h-4 w-4 text-purple-400" />
            <span>Select Date *</span>
          </Label>
          <div className="border-2 border-slate-600/50 rounded-lg p-4 bg-slate-800/50 backdrop-blur-sm">
            <Calendar
              mode="single"
              selected={formData.selectedDate}
              onSelect={(date) => setFormData(prev => ({ ...prev, selectedDate: date }))}
              disabled={(date) => {
                // Allow today and future dates, disable past dates
                const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                return dateOnly < today;
              }}
              className="w-full [&_.rdp-day]:text-white [&_.rdp-day_button:hover]:bg-slate-600 [&_.rdp-day_button[aria-selected]]:bg-blue-600 [&_.rdp-caption]:text-white [&_.rdp-nav_button]:text-white [&_.rdp-nav_button:hover]:bg-slate-600"
            />
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-medium flex items-center space-x-2 text-white">
            <Clock className="h-4 w-4 text-purple-400" />
            <span>Available Time Slots *</span>
          </Label>
          
          <div className="border-2 border-slate-600/50 rounded-lg p-4 bg-slate-800/50 backdrop-blur-sm">
            {!formData.selectedDate ? (
              <div className="text-center py-8 text-slate-400">
                <CalendarIcon className="h-12 w-12 mx-auto text-slate-500 mb-3" />
                <p>Please select a date first</p>
              </div>
            ) : loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-3"></div>
                <p className="text-slate-400">Loading availability...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-slate-300 p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span>Available</span>
                    <div className="w-3 h-3 bg-red-400 rounded-full ml-4"></div>
                    <span>Booked</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Times based on worker availability (ZIP: {formData.zipcode})
                    {formData.selectedDate && formData.selectedDate.toDateString() === today.toDateString() && 
                      " • Same-day booking available! (30 min advance notice)"
                    }
                  </p>
                </div>
                
                {filteredAvailableSlots.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="h-12 w-12 mx-auto text-slate-500 mb-3" />
                    <p>No time slots available for this date</p>
                    {formData.selectedDate && formData.selectedDate.toDateString() === today.toDateString() && (
                      <p className="text-sm text-orange-400 mt-2">
                        For same-day service, please allow at least 30 minutes advance notice
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {filteredAvailableSlots.map((time) => {
                      const isSelected = formData.selectedTime === time;
                      
                      return (
                        <Button
                          key={time}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, selectedTime: time }))}
                          className={cn(
                            "h-12 text-sm font-medium transition-all duration-200 relative",
                            isSelected && "bg-purple-600 text-white border-purple-600 shadow-md",
                            !isSelected && "bg-slate-700/50 text-white border-slate-600 hover:bg-purple-600/20 hover:border-purple-400/50"
                          )}
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span>{time}</span>
                          </div>
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
