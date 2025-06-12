
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Clock, WifiOff, RefreshCw } from 'lucide-react';

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes?: string;
}

interface ScheduleListProps {
  selectedDate: Date;
  schedules: Schedule[];
  fetchError: string | null;
  isOnline: boolean;
  onAddSchedule: () => void;
  onEditSchedule: (schedule: Schedule) => void;
  onDeleteSchedule: (scheduleId: string) => void;
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
  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg font-semibold">
              Schedule for {selectedDate.toLocaleDateString()}
            </CardTitle>
            {!isOnline && (
              <div className="flex items-center text-sm text-green-200 mt-1">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </div>
            )}
          </div>
          <Button
            onClick={onAddSchedule}
            disabled={!isOnline}
            size="sm"
            variant="secondary"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {fetchError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load schedules: {fetchError}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetryLoad}
                disabled={!isOnline}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No schedule set for this date</p>
            <Button
              onClick={onAddSchedule}
              disabled={!isOnline}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Schedule
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-medium">
                    {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                  </div>
                  <Badge variant={schedule.is_available ? "default" : "secondary"}>
                    {schedule.is_available ? "Available" : "Unavailable"}
                  </Badge>
                  {schedule.notes && (
                    <div className="text-xs text-gray-600 italic">
                      {schedule.notes}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditSchedule(schedule)}
                    disabled={!isOnline}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDeleteSchedule(schedule.id)}
                    disabled={!isOnline}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
