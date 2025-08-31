import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { useWorkerCoverageNotifications } from '@/hooks/useWorkerCoverageNotifications';

interface NotificationBellWorkerProps {
  hideIcon?: boolean;
  className?: string;
}

export function NotificationBellWorker({ hideIcon = false, className = "" }: NotificationBellWorkerProps) {
  const { getPendingNotifications } = useWorkerCoverageNotifications();
  const pendingCount = getPendingNotifications().length;

  if (pendingCount === 0) {
    return hideIcon ? null : (
      <div className={`flex items-center ${className}`}>
        <Bell className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className={`flex items-center relative ${className}`}>
      {!hideIcon && <Bell className="h-4 w-4" />}
      <Badge 
        variant="destructive" 
        className="ml-1 text-xs min-w-[1.25rem] h-5 flex items-center justify-center px-1"
      >
        {pendingCount > 99 ? '99+' : pendingCount}
      </Badge>
    </div>
  );
}