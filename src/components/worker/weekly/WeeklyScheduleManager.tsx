import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkerScheduleOperations } from '@/hooks/useWorkerScheduleOperations';
import { useToast } from '@/hooks/use-toast';
import { WeeklyScheduleCard } from './WeeklyScheduleCard';
import { WeeklySchedulePreview } from './WeeklySchedulePreview';

interface WeeklyScheduleManagerProps {
  onScheduleUpdate?: () => void;
  workerId?: string;
}

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

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
] as const;

const WeeklyScheduleManager = ({ onScheduleUpdate, workerId }: WeeklyScheduleManagerProps) => {
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { setWeeklyAvailability: saveWeeklyAvailability, fetchWeeklyAvailability } = useWorkerScheduleOperations(workerId);

  const targetWorkerId = workerId || user?.id;
  const canEdit = !workerId || user?.id === workerId;

  useEffect(() => {
    if (targetWorkerId) {
      loadWeeklyAvailability();
    }
  }, [targetWorkerId]);

  const loadWeeklyAvailability = async () => {
    if (!targetWorkerId) return;
    
    setLoading(true);
    try {
      const result = await fetchWeeklyAvailability();
      if (result.data && typeof result.data === 'object') {
        setWeeklyAvailability(result.data as WeeklyAvailability);
      }
    } catch (error) {
      console.error('Error loading weekly availability:', error);
      toast({
        title: "Error",
        description: "Failed to load weekly schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDayScheduleChange = (day: string, schedule: DaySchedule) => {
    setWeeklyAvailability(prev => ({
      ...prev,
      [day]: schedule
    }));
  };

  const handleSaveWeeklySchedule = async () => {
    if (!targetWorkerId || !canEdit) return;

    setSaving(true);
    try {
      const result = await saveWeeklyAvailability(weeklyAvailability);
      if (!result.error) {
        toast({
          title: "Success",
          description: "Weekly schedule saved successfully",
        });
        if (onScheduleUpdate) onScheduleUpdate();
      }
    } catch (error) {
      console.error('Error saving weekly schedule:', error);
      toast({
        title: "Error",
        description: "Failed to save weekly schedule",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSetup = (preset: 'fulltime' | 'parttime' | 'weekend') => {
    const presets = {
      fulltime: {
        Monday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Tuesday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Wednesday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Thursday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Friday: { enabled: true, start_time: '08:00', end_time: '18:00' },
      },
      parttime: {
        Monday: { enabled: true, start_time: '09:00', end_time: '17:00' },
        Wednesday: { enabled: true, start_time: '09:00', end_time: '17:00' },
        Friday: { enabled: true, start_time: '09:00', end_time: '17:00' },
      },
      weekend: {
        Saturday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Sunday: { enabled: true, start_time: '08:00', end_time: '18:00' },
      }
    };

    setWeeklyAvailability(presets[preset]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading weekly schedule...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Setup Presets */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Quick Setup</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSetup('fulltime')}
              >
                Full Time (Mon-Fri, 8 AM - 6 PM)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSetup('parttime')}
              >
                Part Time (Mon/Wed/Fri, 9 AM - 5 PM)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSetup('weekend')}
              >
                Weekends (Sat-Sun, 8 AM - 6 PM)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Schedule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {DAYS_OF_WEEK.map(day => (
          <WeeklyScheduleCard
            key={day}
            day={day}
            schedule={weeklyAvailability[day] || { enabled: false, start_time: '08:00', end_time: '18:00' }}
            onChange={(schedule) => handleDayScheduleChange(day, schedule)}
            canEdit={canEdit}
          />
        ))}
      </div>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveWeeklySchedule}
            disabled={saving}
            className="min-w-32"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Weekly Schedule
              </>
            )}
          </Button>
        </div>
      )}

      {/* Preview */}
      <WeeklySchedulePreview weeklyAvailability={weeklyAvailability} />
    </div>
  );
};

export default WeeklyScheduleManager;