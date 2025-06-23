
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Calendar } from 'lucide-react';
import { WorkerActionsDropdown } from './WorkerActionsDropdown';

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
  onRemoveWorker: (workerId: string) => void;
  removingWorkerId: string | null;
}

export const WorkerTableRow = ({ 
  worker, 
  onViewCalendar, 
  onEditWorker, 
  onRemoveWorker, 
  removingWorkerId 
}: WorkerTableRowProps) => {
  const getAvailabilityBadge = (workerAvailability: any[]) => {
    if (!workerAvailability || workerAvailability.length === 0) {
      return <Badge variant="secondary">Not Set</Badge>;
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
            onRemoveWorker={onRemoveWorker}
            removingWorkerId={removingWorkerId}
          />
        </div>
      </TableCell>
    </TableRow>
  );
};
