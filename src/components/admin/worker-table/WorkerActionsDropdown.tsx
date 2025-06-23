
import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, MoreVertical, UserX } from 'lucide-react';

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

interface WorkerActionsDropdownProps {
  worker: Worker;
  onEditWorker: (worker: Worker) => void;
  onRemoveWorker: (workerId: string) => void;
  removingWorkerId: string | null;
}

export const WorkerActionsDropdown = ({ 
  worker, 
  onEditWorker, 
  onRemoveWorker, 
  removingWorkerId 
}: WorkerActionsDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEditWorker(worker)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Details
        </DropdownMenuItem>
        {worker.is_active && (
          <DropdownMenuItem 
            onClick={() => onRemoveWorker(worker.id)}
            disabled={removingWorkerId === worker.id}
            className="text-red-600 hover:text-red-700 focus:text-red-700"
          >
            <UserX className="h-4 w-4 mr-2" />
            {removingWorkerId === worker.id ? 'Removing...' : 'Remove Worker'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
