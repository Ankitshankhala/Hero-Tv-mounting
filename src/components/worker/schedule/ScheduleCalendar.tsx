
import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WifiOff } from 'lucide-react';

interface ScheduleCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  isOnline: boolean;
}

export const ScheduleCalendar = ({ selectedDate, onDateSelect, isOnline }: ScheduleCalendarProps) => {
  return (
    <Card className="w-full">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
        <CardTitle className="text-lg font-semibold text-center">Set Your Availability</CardTitle>
        <p className="text-sm text-purple-100 text-center">Select a date to manage your schedule</p>
        {!isOnline && (
          <div className="flex items-center justify-center text-sm text-purple-200">
            <WifiOff className="h-4 w-4 mr-1" />
            Offline
          </div>
        )}
      </CardHeader>
      <CardContent className="p-6">
        <div className="w-full overflow-hidden">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onDateSelect(date)}
            className="w-full mx-auto"
            disabled={!isOnline}
            classNames={{
              months: "flex flex-col space-y-4 w-full",
              month: "space-y-4 w-full",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-medium",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border rounded",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] text-center p-0 min-w-0",
              row: "flex w-full mt-1",
              cell: "text-center text-sm p-0 relative flex-1 min-w-0 aspect-square",
              day: "h-8 w-8 p-0 font-normal hover:bg-accent rounded-md transition-colors mx-auto flex items-center justify-center text-xs",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground font-semibold",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_hidden: "invisible",
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};
