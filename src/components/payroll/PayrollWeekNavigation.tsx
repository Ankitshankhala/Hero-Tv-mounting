import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface PayrollWeekNavigationProps {
  currentWeekStart: Date;
  onWeekChange: (date: Date) => void;
  className?: string;
}

type QuickFilter = 'this-week' | 'last-week' | 'last-4-weeks';

export function PayrollWeekNavigation({ 
  currentWeekStart, 
  onWeekChange,
  className 
}: PayrollWeekNavigationProps) {
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const today = startOfWeek(new Date(), { weekStartsOn: 1 });
  const isCurrentWeek = format(today, 'yyyy-MM-dd') === format(currentWeekStart, 'yyyy-MM-dd');

  const handleQuickFilter = (filter: QuickFilter) => {
    setActiveFilter(filter);
    const now = new Date();
    const todayStart = startOfWeek(now, { weekStartsOn: 1 });

    switch (filter) {
      case 'this-week':
        onWeekChange(todayStart);
        break;
      case 'last-week':
        onWeekChange(subWeeks(todayStart, 1));
        break;
      case 'last-4-weeks':
        onWeekChange(subWeeks(todayStart, 3));
        break;
    }
  };

  const handlePreviousWeek = () => {
    setActiveFilter(null);
    onWeekChange(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setActiveFilter(null);
    onWeekChange(addWeeks(currentWeekStart, 1));
  };

  const handleDateRangeSelect = (dateRange: DateRange | undefined) => {
    if (dateRange?.from) {
      setActiveFilter(null);
      const weekStart = startOfWeek(dateRange.from, { weekStartsOn: 1 });
      onWeekChange(weekStart);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick Filter Chips */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button
          variant={activeFilter === 'this-week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('this-week')}
          className="gap-1.5"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          This Week
        </Button>
        <Button
          variant={activeFilter === 'last-week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('last-week')}
          className="gap-1.5"
        >
          Last Week
        </Button>
        <Button
          variant={activeFilter === 'last-4-weeks' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('last-4-weeks')}
          className="gap-1.5"
        >
          Last 4 Weeks
        </Button>
      </div>

      {/* Stepper with Calendar Picker */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePreviousWeek}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <DatePickerWithRange
          date={{
            from: currentWeekStart,
            to: weekEnd,
          }}
          setDate={handleDateRangeSelect}
          className="flex-shrink-0"
        />

        <Button
          variant="outline"
          size="icon"
          onClick={handleNextWeek}
          className="h-9 w-9"
          disabled={isCurrentWeek}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Current Week Label */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </p>
      </div>
    </div>
  );
}
