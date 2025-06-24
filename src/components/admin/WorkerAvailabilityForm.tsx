
import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { WorkerFormData } from '@/hooks/useWorkerForm';
import { useWorkerWeeklyAvailability, WeeklyAvailability } from '@/hooks/useWorkerWeeklyAvailability';

interface WorkerAvailabilityFormProps {
  formData: WorkerFormData;
  onAvailabilityChange: (day: string, checked: boolean) => void;
  workerId?: string;
}

const daysOfWeek = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export const WorkerAvailabilityForm = ({ formData, onAvailabilityChange, workerId }: WorkerAvailabilityFormProps) => {
  const { fetchWeeklyAvailability, saveWeeklyAvailability, loading } = useWorkerWeeklyAvailability();
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>({
    Monday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Tuesday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Wednesday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Thursday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Friday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Saturday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Sunday: { enabled: false, start_time: '09:00', end_time: '17:00' },
  });

  useEffect(() => {
    if (workerId) {
      loadAvailability();
    }
  }, [workerId]);

  const loadAvailability = async () => {
    if (!workerId) return;
    
    try {
      const data = await fetchWeeklyAvailability(workerId);
      setWeeklyAvailability(data);
    } catch (error) {
      console.error('Failed to load weekly availability:', error);
    }
  };

  const handleDayToggle = (dayKey: string, dayLabel: string) => {
    // Update the original formData for backward compatibility
    onAvailabilityChange(dayKey, !formData.availability[dayKey as keyof typeof formData.availability]);
    
    // Also update the weekly availability
    setWeeklyAvailability(prev => ({
      ...prev,
      [dayLabel]: {
        ...prev[dayLabel],
        enabled: !prev[dayLabel].enabled
      }
    }));
  };

  const handleTimeChange = (day: string, field: 'start_time' | 'end_time', value: string) => {
    setWeeklyAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-4">
      <Label>Weekly Availability</Label>
      <div className="space-y-4">
        {daysOfWeek.map((day) => {
          const dayName = day.label;
          const isEnabled = formData.availability[day.key as keyof typeof formData.availability] || weeklyAvailability[dayName]?.enabled;
          
          return (
            <div key={day.key} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <Switch
                  id={day.key}
                  checked={isEnabled}
                  onCheckedChange={() => handleDayToggle(day.key, dayName)}
                />
                <Label htmlFor={day.key} className="w-20 font-medium">{day.label}</Label>
              </div>
              
              {isEnabled && (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm">From</Label>
                    <Input
                      type="time"
                      value={weeklyAvailability[dayName]?.start_time || '09:00'}
                      onChange={(e) => handleTimeChange(dayName, 'start_time', e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm">To</Label>
                    <Input
                      type="time"
                      value={weeklyAvailability[dayName]?.end_time || '17:00'}
                      onChange={(e) => handleTimeChange(dayName, 'end_time', e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
