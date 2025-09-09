
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Phone, MapPin, Calendar, Clock, Settings } from 'lucide-react';
import { WorkerActionsDropdown } from './WorkerActionsDropdown';
import { supabase } from '@/integrations/supabase/client';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city: string;
  region: string;
  is_active: boolean;
  created_at: string;
  worker_availability?: any[];
}

interface WorkerTableRowProps {
  worker: Worker;
  onViewCalendar: (worker: Worker) => void;
  onEditWorker: (worker: Worker) => void;
  onManagePassword: (worker: Worker) => void;
  onManageCoverage: (worker: Worker) => void;
  onRemoveWorker: (workerId: string) => void;
  onReactivateWorker: (workerId: string) => void;
  onPermanentlyDeleteWorker: (workerId: string) => void;
  onSetWeeklyAvailability: (worker: Worker) => void;
  removingWorkerId: string | null;
  reactivatingWorkerId: string | null;
  deletingWorkerId: string | null;
}

export const WorkerTableRow = ({ 
  worker, 
  onViewCalendar, 
  onEditWorker, 
  onManagePassword,
  onManageCoverage,
  onRemoveWorker,
  onReactivateWorker,
  onPermanentlyDeleteWorker,
  onSetWeeklyAvailability,
  removingWorkerId,
  reactivatingWorkerId,
  deletingWorkerId
}: WorkerTableRowProps) => {
  const [futureAvailableScheduleCount, setFutureAvailableScheduleCount] = useState<number>(0);

  useEffect(() => {
    const fetchSpecificSchedules = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('worker_schedule')
        .select('*')
        .eq('worker_id', worker.id)
        .eq('is_available', true)
        .gte('work_date', today);
      
      if (!error && data) {
        setFutureAvailableScheduleCount(data.length);
      }
    };

    fetchSpecificSchedules();

    // Subscribe to worker-specific schedule changes
    const scheduleChannel = supabase
      .channel(`worker-schedule-${worker.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_schedule',
          filter: `worker_id=eq.${worker.id}`
        },
        () => {
          fetchSpecificSchedules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scheduleChannel);
    };
  }, [worker.id]);

  const getAvailabilityBadge = (workerAvailability: any[]) => {
    // If worker is inactive, show inactive status
    if (!worker.is_active) {
      return <Badge variant="destructive">Inactive</Badge>;
    }

    const hasWeeklyAvailability = workerAvailability && workerAvailability.length > 0;
    
    // No weekly availability and no future specific schedules
    if (!hasWeeklyAvailability && futureAvailableScheduleCount === 0) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Unavailable</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetWeeklyAvailability(worker)}
            className="h-6 px-2 text-xs"
          >
            <Clock className="h-3 w-3 mr-1" />
            Set
          </Button>
        </div>
      );
    }
    
    // Has specific future schedules but no weekly availability
    if (!hasWeeklyAvailability && futureAvailableScheduleCount > 0) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline">Specific: {futureAvailableScheduleCount} dates</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetWeeklyAvailability(worker)}
            className="h-6 px-2 text-xs"
          >
            <Clock className="h-3 w-3 mr-1" />
            Set Weekly
          </Button>
        </div>
      );
    }
    
    // Has weekly availability
    if (hasWeeklyAvailability) {
      const enabledDays = workerAvailability.length;
      if (futureAvailableScheduleCount > 0) {
        return (
          <div className="flex items-center gap-2">
            <Badge variant="default">Weekly: {enabledDays} days</Badge>
            <Badge variant="outline">+{futureAvailableScheduleCount} specific</Badge>
          </div>
        );
      }
      return <Badge variant="default">Weekly: {enabledDays} days</Badge>;
    }
    
    return <Badge variant="secondary">Unavailable</Badge>;
  };

  return (
    <TableRow key={worker.id}>
      <TableCell>
        <div className="font-medium">{worker.name}</div>
        <div className="text-sm text-gray-600">{worker.email}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2 text-sm">
          <Phone className="h-3 w-3" />
          <span>{worker.phone || 'Not provided'}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2 text-sm">
          <MapPin className="h-3 w-3" />
          <span>{worker.city}, {worker.region}</span>
        </div>
      </TableCell>
      <TableCell>
        <div>
          {getAvailabilityBadge(worker.worker_availability)}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={worker.is_active ? 'default' : 'secondary'}>
          {worker.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm text-gray-600">
          {new Date(worker.created_at).toLocaleDateString()}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onViewCalendar(worker)}
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Calendar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onManageCoverage(worker)}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Manage Coverage Areas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <WorkerActionsDropdown
                  worker={worker}
                  onEditWorker={onEditWorker}
                  onManagePassword={onManagePassword}
                  onManageCoverage={onManageCoverage}
                  onRemoveWorker={onRemoveWorker}
                  onReactivateWorker={onReactivateWorker}
                  onPermanentlyDeleteWorker={onPermanentlyDeleteWorker}
                  removingWorkerId={removingWorkerId}
                  reactivatingWorkerId={reactivatingWorkerId}
                  deletingWorkerId={deletingWorkerId}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>More Actions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
};
