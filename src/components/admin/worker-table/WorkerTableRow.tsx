
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Calendar, Clock } from 'lucide-react';
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
  onRemoveWorker,
  onReactivateWorker,
  onPermanentlyDeleteWorker,
  onSetWeeklyAvailability,
  removingWorkerId,
  reactivatingWorkerId,
  deletingWorkerId
}: WorkerTableRowProps) => {
  const [specificScheduleCount, setSpecificScheduleCount] = useState<number>(0);

  useEffect(() => {
    const fetchSpecificSchedules = async () => {
      const { data, error } = await supabase
        .from('worker_schedule')
        .select('*')
        .eq('worker_id', worker.id);
      
      if (!error && data) {
        setSpecificScheduleCount(data.length);
      }
    };

    fetchSpecificSchedules();
  }, [worker.id]);

  const getAvailabilityBadge = (workerAvailability: any[]) => {
    const hasWeeklyAvailability = workerAvailability && workerAvailability.length > 0;
    
    if (!hasWeeklyAvailability && specificScheduleCount === 0) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Not Set</Badge>
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
    
    if (!hasWeeklyAvailability && specificScheduleCount > 0) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{specificScheduleCount} specific dates</Badge>
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
    
    return <Badge variant="default">Available</Badge>;
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
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onViewCalendar(worker)}
          >
            <Calendar className="h-4 w-4" />
          </Button>
          
          <WorkerActionsDropdown
            worker={worker}
            onEditWorker={onEditWorker}
            onManagePassword={onManagePassword}
            onRemoveWorker={onRemoveWorker}
            onReactivateWorker={onReactivateWorker}
            onPermanentlyDeleteWorker={onPermanentlyDeleteWorker}
            removingWorkerId={removingWorkerId}
            reactivatingWorkerId={reactivatingWorkerId}
            deletingWorkerId={deletingWorkerId}
          />
        </div>
      </TableCell>
    </TableRow>
  );
};
