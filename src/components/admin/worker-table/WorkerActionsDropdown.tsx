
import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Edit, MoreVertical, UserX, UserCheck, Trash2 } from 'lucide-react';

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
  onReactivateWorker: (workerId: string) => void;
  onPermanentlyDeleteWorker: (workerId: string) => void;
  removingWorkerId: string | null;
  reactivatingWorkerId: string | null;
  deletingWorkerId: string | null;
}

export const WorkerActionsDropdown = ({ 
  worker, 
  onEditWorker, 
  onRemoveWorker, 
  onReactivateWorker,
  onPermanentlyDeleteWorker,
  removingWorkerId,
  reactivatingWorkerId,
  deletingWorkerId
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
        
        {worker.is_active ? (
          <DropdownMenuItem 
            onClick={() => onRemoveWorker(worker.id)}
            disabled={removingWorkerId === worker.id}
            className="text-red-600 hover:text-red-700 focus:text-red-700"
          >
            <UserX className="h-4 w-4 mr-2" />
            {removingWorkerId === worker.id ? 'Removing...' : 'Remove Worker'}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onReactivateWorker(worker.id)}
              disabled={reactivatingWorkerId === worker.id}
              className="text-green-600 hover:text-green-700 focus:text-green-700"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {reactivatingWorkerId === worker.id ? 'Reactivating...' : 'Reactivate Worker'}
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => onPermanentlyDeleteWorker(worker.id)}
              disabled={deletingWorkerId === worker.id}
              className="text-red-600 hover:text-red-700 focus:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deletingWorkerId === worker.id ? 'Deleting...' : 'Permanently Delete'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
