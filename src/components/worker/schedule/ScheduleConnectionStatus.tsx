
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, AlertTriangle } from 'lucide-react';

interface ScheduleConnectionStatusProps {
  isOnline: boolean;
  fetchError: string | null;
}

export const ScheduleConnectionStatus = ({ isOnline, fetchError }: ScheduleConnectionStatusProps) => {
  if (isOnline && !fetchError) {
    return null;
  }

  return (
    <div className="space-y-4 mb-4">
      {!isOnline && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            No internet connection. Schedule management is unavailable.
          </AlertDescription>
        </Alert>
      )}

      {fetchError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load schedules: {fetchError}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
