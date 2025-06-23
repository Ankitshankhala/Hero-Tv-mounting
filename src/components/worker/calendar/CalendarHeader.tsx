
import React from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CalendarIcon } from 'lucide-react';

interface CalendarHeaderProps {
  workerId?: string;
  isConnected: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const CalendarHeader = ({ workerId, isConnected, isRefreshing, onRefresh }: CalendarHeaderProps) => {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5" />
          <span>{workerId ? 'Worker Schedule' : 'My Schedule'}</span>
          {isConnected && (
            <Badge variant="outline" className="text-green-600">
              ● Live
            </Badge>
          )}
        </CardTitle>
        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </CardHeader>
  );
};
