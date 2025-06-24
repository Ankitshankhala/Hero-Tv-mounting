
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Clock, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkerWeeklyAvailability, WeeklyAvailability } from '@/hooks/useWorkerWeeklyAvailability';

interface WeeklyAvailabilityManagerProps {
  workerId?: string; // Optional for admin use
}

const daysOfWeek = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

export const WeeklyAvailabilityManager = ({ workerId }: WeeklyAvailabilityManagerProps) => {
  const { user } = useAuth();
  const targetWorkerId = workerId || user?.id;
  const { fetchWeeklyAvailability, saveWeeklyAvailability, loading } = useWorkerWeeklyAvailability();
  
  const [availability, setAvailability] = useState<WeeklyAvailability>({
    Monday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Tuesday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Wednesday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Thursday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Friday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Saturday: { enabled: false, start_time: '09:00', end_time: '17:00' },
    Sunday: { enabled: false, start_time: '09:00', end_time: '17:00' },
  });

  useEffect(() => {
    if (targetWorkerId) {
      loadAvailability();
    }
  }, [targetWorkerId]);

  const loadAvailability = async () => {
    if (!targetWorkerId) return;
    
    try {
      const data = await fetchWeeklyAvailability(targetWorkerId);
      setAvailability(data);
    } catch (error) {
      console.error('Failed to load weekly availability:', error);
    }
  };

  const handleDayToggle = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled
      }
    }));
  };

  const handleTimeChange = (day: string, field: 'start_time' | 'end_time', value: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!targetWorkerId) return;
    
    try {
      await saveWeeklyAvailability(targetWorkerId, availability);
    } catch (error) {
      console.error('Failed to save weekly availability:', error);
    }
  };

  if (!targetWorkerId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-slate-500">No worker ID available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Weekly Availability</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {daysOfWeek.map((day) => (
            <div key={day} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <Switch
                  checked={availability[day].enabled}
                  onCheckedChange={() => handleDayToggle(day)}
                />
                <Label className="w-20 font-medium">{day}</Label>
              </div>
              
              {availability[day].enabled && (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm">From</Label>
                    <Input
                      type="time"
                      value={availability[day].start_time}
                      onChange={(e) => handleTimeChange(day, 'start_time', e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm">To</Label>
                    <Input
                      type="time"
                      value={availability[day].end_time}
                      onChange={(e) => handleTimeChange(day, 'end_time', e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Availability
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
