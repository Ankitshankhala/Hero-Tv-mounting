import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { formatTimeTo12Hour } from '@/utils/timeUtils';

interface DaySchedule {
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface WeeklyAvailability {
  Sunday?: DaySchedule;
  Monday?: DaySchedule;
  Tuesday?: DaySchedule;
  Wednesday?: DaySchedule;
  Thursday?: DaySchedule;
  Friday?: DaySchedule;
  Saturday?: DaySchedule;
}

interface WeeklySchedulePreviewProps {
  weeklyAvailability: WeeklyAvailability;
}

const WeeklySchedulePreview = ({ weeklyAvailability }: WeeklySchedulePreviewProps) => {
  // Generate next 30 days preview
  const generateUpcomingDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }) as keyof WeeklyAvailability;
      const daySchedule = weeklyAvailability[dayName];
      
      dates.push({
        date,
        dayName,
        schedule: daySchedule,
        isAvailable: daySchedule?.enabled || false
      });
    }
    
    return dates;
  };

  // Calculate weekly statistics
  const getWeeklyStats = () => {
    const enabledDays = Object.values(weeklyAvailability).filter(day => day?.enabled).length;
    const totalHours = Object.values(weeklyAvailability)
      .filter(day => day?.enabled)
      .reduce((total, day) => {
        if (!day) return total;
        const start = new Date(`1970-01-01T${day.start_time}`);
        const end = new Date(`1970-01-01T${day.end_time}`);
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return total + diffHours;
      }, 0);

    return { enabledDays, totalHours };
  };

  const upcomingDates = generateUpcomingDates();
  const { enabledDays, totalHours } = getWeeklyStats();

  return (
    <div className="space-y-6">
      {/* Weekly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Weekly Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{enabledDays}</div>
              <div className="text-sm text-muted-foreground">Days per week</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{totalHours}</div>
              <div className="text-sm text-muted-foreground">Hours per week</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {enabledDays > 0 ? Math.round(totalHours / enabledDays * 10) / 10 : 0}
              </div>
              <div className="text-sm text-muted-foreground">Avg hours per day</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Next 30 Days Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enabledDays === 0 ? (
            <div className="flex items-center space-x-2 text-muted-foreground p-4">
              <AlertCircle className="h-5 w-5" />
              <span>No days configured. Set up your weekly availability above.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {upcomingDates.map((dateInfo, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border text-sm ${
                    dateInfo.isAvailable
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        {dateInfo.date.toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {dateInfo.dayName}
                      </div>
                    </div>
                    <div className="text-right">
                      {dateInfo.isAvailable ? (
                        <div className="text-green-600 dark:text-green-400">
                          <div className="text-xs">
                            {formatTimeTo12Hour(dateInfo.schedule!.start_time)}
                          </div>
                          <div className="text-xs">
                            to {formatTimeTo12Hour(dateInfo.schedule!.end_time)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 text-xs">
                          Unavailable
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export { WeeklySchedulePreview };