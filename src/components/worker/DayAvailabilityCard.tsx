import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DayAvailability } from '@/hooks/useWorkerForm';

interface DayAvailabilityCardProps {
  day: string;
  label: string;
  availability: DayAvailability;
  onChange: (field: 'enabled' | 'startTime' | 'endTime', value: boolean | string) => void;
}

export const DayAvailabilityCard = ({ day, label, availability, onChange }: DayAvailabilityCardProps) => {
  const formatTimeForDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <Card className={`transition-all ${availability.enabled ? 'bg-primary/5 border-primary/20' : 'bg-background'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={day}
            checked={availability.enabled}
            onCheckedChange={(checked) => onChange('enabled', checked as boolean)}
          />
          <Label htmlFor={day} className="font-medium">{label}</Label>
        </div>
        
        {availability.enabled && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`${day}-start`} className="text-xs text-muted-foreground">Start Time</Label>
                <Input
                  id={`${day}-start`}
                  type="time"
                  value={availability.startTime}
                  onChange={(e) => onChange('startTime', e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor={`${day}-end`} className="text-xs text-muted-foreground">End Time</Label>
                <Input
                  id={`${day}-end`}
                  type="time"
                  value={availability.endTime}
                  onChange={(e) => onChange('endTime', e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {formatTimeForDisplay(availability.startTime)} - {formatTimeForDisplay(availability.endTime)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};