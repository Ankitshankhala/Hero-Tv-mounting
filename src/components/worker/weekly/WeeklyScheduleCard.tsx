import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';
import { formatTimeTo12Hour } from '@/utils/timeUtils';

interface DaySchedule {
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface WeeklyScheduleCardProps {
  day: string;
  schedule: DaySchedule;
  onChange: (schedule: DaySchedule) => void;
  canEdit: boolean;
}

// Generate time options in ascending order starting from business hours (6 AM)
const generateTimeOptions = () => {
  const times = [];
  
  // Start from 6:00 AM for business hours focus
  for (let hour = 6; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const time12 = formatTimeTo12Hour(time24);
      times.push({ value: time24, label: time12 });
    }
  }
  
  // Add early morning hours (midnight to 5:30 AM) at the end for late shifts
  for (let hour = 0; hour < 6; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const time12 = formatTimeTo12Hour(time24);
      times.push({ value: time24, label: time12 });
    }
  }
  
  return times;
};

const WeeklyScheduleCard = ({ day, schedule, onChange, canEdit }: WeeklyScheduleCardProps) => {
  const timeOptions = generateTimeOptions();

  const handleToggle = (enabled: boolean) => {
    onChange({
      ...schedule,
      enabled
    });
  };

  const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => {
    onChange({
      ...schedule,
      [field]: value
    });
  };

  const getDayColor = (day: string) => {
    const colors = {
      'Sunday': 'text-red-600 dark:text-red-400',
      'Monday': 'text-blue-600 dark:text-blue-400',
      'Tuesday': 'text-green-600 dark:text-green-400',
      'Wednesday': 'text-purple-600 dark:text-purple-400',
      'Thursday': 'text-orange-600 dark:text-orange-400',
      'Friday': 'text-pink-600 dark:text-pink-400',
      'Saturday': 'text-red-600 dark:text-red-400',
    };
    return colors[day as keyof typeof colors] || 'text-gray-600 dark:text-gray-400';
  };

  return (
    <Card className={`transition-all duration-200 ${
      schedule.enabled 
        ? 'border-primary/50 bg-primary/5' 
        : 'border-muted bg-muted/20'
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-lg font-semibold ${getDayColor(day)}`}>
          {day}
        </CardTitle>
        {canEdit && (
          <div className="flex items-center space-x-2">
            <Switch
              checked={schedule.enabled}
              onCheckedChange={handleToggle}
              className="data-[state=checked]:bg-primary"
            />
            <span className="text-sm text-muted-foreground">
              {schedule.enabled ? 'Available' : 'Unavailable'}
            </span>
          </div>
        )}
        {!canEdit && (
          <span className={`text-sm font-medium ${
            schedule.enabled ? 'text-green-600' : 'text-gray-500'
          }`}>
            {schedule.enabled ? 'Available' : 'Unavailable'}
          </span>
        )}
      </CardHeader>
      
      {schedule.enabled && (
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Start Time
              </label>
              {canEdit ? (
                <Select
                  value={schedule.start_time}
                  onValueChange={(value) => handleTimeChange('start_time', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{formatTimeTo12Hour(schedule.start_time)}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(time => (
                      <SelectItem key={`start-${time.value}`} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatTimeTo12Hour(schedule.start_time)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                End Time
              </label>
              {canEdit ? (
                <Select
                  value={schedule.end_time}
                  onValueChange={(value) => handleTimeChange('end_time', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{formatTimeTo12Hour(schedule.end_time)}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(time => (
                      <SelectItem key={`end-${time.value}`} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatTimeTo12Hour(schedule.end_time)}</span>
                </div>
              )}
            </div>
          </div>

          {schedule.enabled && (
            <div className="pt-2 border-t border-muted">
              <div className="text-xs text-muted-foreground">
                Duration: {(() => {
                  const start = new Date(`1970-01-01T${schedule.start_time}`);
                  const end = new Date(`1970-01-01T${schedule.end_time}`);
                  const diffMs = end.getTime() - start.getTime();
                  const diffHours = diffMs / (1000 * 60 * 60);
                  return `${diffHours} hours`;
                })()}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export { WeeklyScheduleCard };