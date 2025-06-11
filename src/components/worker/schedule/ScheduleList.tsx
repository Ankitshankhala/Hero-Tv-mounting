
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';

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
      <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <div className="text-center flex-1">
            <CardTitle className="text-lg font-semibold">
              Schedule for {selectedDate.toLocaleDateString()}
            </CardTitle>
          </div>
          <Button 
            onClick={onAddSchedule}
            className="bg-white text-orange-700 hover:bg-orange-50 border-0 ml-4"
            size="sm"
            disabled={!isOnline}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Time Slot
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {fetchError ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-muted-foreground">Failed to load schedule</p>
            <Button 
              onClick={onRetryLoad}
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={!isOnline}
            >
              Retry
            </Button>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No schedule set for this date</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="bg-card rounded-lg p-4 border border-border hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-card-foreground font-medium">
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </span>
                      <Badge variant={schedule.is_available ? 'default' : 'secondary'}>
                        {schedule.is_available ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                    {schedule.notes && (
                      <p className="text-muted-foreground text-sm">{schedule.notes}</p>
                    )}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditSchedule(schedule)}
                      className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      disabled={!isOnline}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeleteSchedule(schedule.id)}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                      disabled={!isOnline}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
