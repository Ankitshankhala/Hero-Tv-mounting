import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkerScheduleOperations } from '@/hooks/useWorkerScheduleOperations';

interface Worker {
  id: string;
  name: string;
  email: string;
}

interface WorkerWeeklyAvailabilityModalProps {
  worker: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onWorkerUpdate?: () => void;
}

interface DaySchedule {
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface WeeklyAvailability {
  Monday?: DaySchedule;
  Tuesday?: DaySchedule;
  Wednesday?: DaySchedule;
  Thursday?: DaySchedule;
  Friday?: DaySchedule;
  Saturday?: DaySchedule;
  Sunday?: DaySchedule;
}

export const WorkerWeeklyAvailabilityModal = ({ 
  worker, 
  isOpen, 
  onClose, 
  onWorkerUpdate 
}: WorkerWeeklyAvailabilityModalProps) => {
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { setWeeklyAvailability: saveWeeklyAvailability } = useWorkerScheduleOperations(worker?.id);

  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

  const handleQuickSetup = (preset: 'fulltime' | 'parttime' | 'weekend') => {
    const presets = {
      fulltime: {
        Monday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Tuesday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Wednesday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Thursday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Friday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Saturday: { enabled: false, start_time: '08:00', end_time: '18:00' },
        Sunday: { enabled: false, start_time: '08:00', end_time: '18:00' },
      },
      parttime: {
        Monday: { enabled: true, start_time: '09:00', end_time: '15:00' },
        Tuesday: { enabled: false, start_time: '09:00', end_time: '15:00' },
        Wednesday: { enabled: true, start_time: '09:00', end_time: '15:00' },
        Thursday: { enabled: false, start_time: '09:00', end_time: '15:00' },
        Friday: { enabled: true, start_time: '09:00', end_time: '15:00' },
        Saturday: { enabled: false, start_time: '09:00', end_time: '15:00' },
        Sunday: { enabled: false, start_time: '09:00', end_time: '15:00' },
      },
      weekend: {
        Monday: { enabled: false, start_time: '08:00', end_time: '18:00' },
        Tuesday: { enabled: false, start_time: '08:00', end_time: '18:00' },
        Wednesday: { enabled: false, start_time: '08:00', end_time: '18:00' },
        Thursday: { enabled: false, start_time: '08:00', end_time: '18:00' },
        Friday: { enabled: false, start_time: '08:00', end_time: '18:00' },
        Saturday: { enabled: true, start_time: '08:00', end_time: '18:00' },
        Sunday: { enabled: true, start_time: '08:00', end_time: '18:00' },
      }
    };
    
    setWeeklyAvailability(presets[preset]);
  };

  const handleDayScheduleChange = (day: string, schedule: DaySchedule) => {
    setWeeklyAvailability(prev => ({
      ...prev,
      [day]: schedule
    }));
  };

  const handleSave = async () => {
    if (!worker) return;

    setSaving(true);
    try {
      const result = await saveWeeklyAvailability(weeklyAvailability);
      if (!result.error) {
        toast({
          title: "Success",
          description: `Weekly availability set for ${worker.name}`,
        });
        if (onWorkerUpdate) onWorkerUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Error saving weekly availability:', error);
      toast({
        title: "Error",
        description: "Failed to save weekly availability",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!worker) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Set Weekly Availability - {worker.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Setup Buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSetup('fulltime')}
                >
                  Full-time (Mon-Fri, 8AM-6PM)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSetup('parttime')}
                >
                  Part-time (Mon/Wed/Fri, 9AM-3PM)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSetup('weekend')}
                >
                  Weekends Only (Sat-Sun, 8AM-6PM)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Daily Schedule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DAYS_OF_WEEK.map((day) => (
              <DayScheduleCard
                key={day}
                day={day}
                schedule={weeklyAvailability[day] || { enabled: false, start_time: '08:00', end_time: '18:00' }}
                onChange={(schedule) => handleDayScheduleChange(day, schedule)}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Weekly Availability'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface DayScheduleCardProps {
  day: string;
  schedule: DaySchedule;
  onChange: (schedule: DaySchedule) => void;
}

const DayScheduleCard = ({ day, schedule, onChange }: DayScheduleCardProps) => {
  const handleToggle = (enabled: boolean) => {
    onChange({ ...schedule, enabled });
  };

  const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => {
    onChange({ ...schedule, [field]: value });
  };

  const getDayColor = (day: string) => {
    const colors = {
      Monday: 'bg-blue-50 border-blue-200',
      Tuesday: 'bg-green-50 border-green-200',
      Wednesday: 'bg-yellow-50 border-yellow-200',
      Thursday: 'bg-purple-50 border-purple-200',
      Friday: 'bg-pink-50 border-pink-200',
      Saturday: 'bg-orange-50 border-orange-200',
      Sunday: 'bg-red-50 border-red-200',
    };
    return colors[day as keyof typeof colors] || 'bg-gray-50 border-gray-200';
  };

  return (
    <Card className={`${getDayColor(day)} ${schedule.enabled ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{day}</CardTitle>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => handleToggle(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-xs">Available</span>
          </label>
        </div>
      </CardHeader>
      {schedule.enabled && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Start Time</label>
              <input
                type="time"
                value={schedule.start_time}
                onChange={(e) => handleTimeChange('start_time', e.target.value)}
                className="w-full mt-1 px-2 py-1 text-sm border border-border rounded"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End Time</label>
              <input
                type="time"
                value={schedule.end_time}
                onChange={(e) => handleTimeChange('end_time', e.target.value)}
                className="w-full mt-1 px-2 py-1 text-sm border border-border rounded"
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};