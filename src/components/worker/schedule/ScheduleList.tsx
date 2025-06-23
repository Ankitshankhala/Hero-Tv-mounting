
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ScheduleListProps {
  selectedDate: Date;
  schedules: any[];
  fetchError: string | null;
  isOnline: boolean;
  onAddSchedule?: () => void;
  onEditSchedule?: (schedule: any) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  onRetryLoad: () => void;
}

export const ScheduleList = ({ 
  selectedDate, 
  schedules, 
  fetchError, 
  isOnline, 
  onAddSchedule,
  onEditSchedule,
  onDeleteSchedule,
  onRetryLoad 
}: ScheduleListProps) => {
  const formattedDate = format(selectedDate, 'EEEE, MMMM d, yyyy');

  return (
    <Card className="w-full">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Schedule for {formattedDate}</CardTitle>
            <p className="text-sm text-blue-100">Manage your availability for this day</p>
          </div>
          {onAddSchedule && (
            <Button
              onClick={onAddSchedule}
              disabled={!isOnline}
              size="sm"
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Schedule
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {fetchError ? (
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Schedules</h3>
            <p className="text-gray-600 mb-4">{fetchError}</p>
            <Button onClick={onRetryLoad} variant="outline" disabled={!isOnline}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Set</h3>
            <p className="text-gray-600 mb-4">You haven't set your availability for this day yet.</p>
            {onAddSchedule && (
              <Button onClick={onAddSchedule} disabled={!isOnline}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Schedule
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(`2000-01-01T${schedule.start_time}`), 'h:mm a')} - {format(new Date(`2000-01-01T${schedule.end_time}`), 'h:mm a')}
                    </Badge>
                  </div>
                </div>
                
                {(onEditSchedule || onDeleteSchedule) && (
                  <div className="flex items-center space-x-2">
                    {onEditSchedule && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditSchedule(schedule)}
                        disabled={!isOnline}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDeleteSchedule && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteSchedule(schedule.id)}
                        disabled={!isOnline}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
