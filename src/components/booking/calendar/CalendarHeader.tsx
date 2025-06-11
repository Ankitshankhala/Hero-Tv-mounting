
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';

interface CalendarHeaderProps {
  weekDays: Date[];
  onNavigateWeek: (direction: 'prev' | 'next') => void;
}

export const CalendarHeader = ({ weekDays, onNavigateWeek }: CalendarHeaderProps) => {
  return (
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
            onClick={() => onNavigateWeek('prev')}
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
            onClick={() => onNavigateWeek('next')}
            className="text-white border-slate-600"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardHeader>
  );
};
