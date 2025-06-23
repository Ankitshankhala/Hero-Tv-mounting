
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, UserMinus } from 'lucide-react';

interface WorkerFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onAddWorker: () => void;
  onDropAllWorkers?: () => void;
  isDropping?: boolean;
}

export const WorkerFilters = ({ 
  searchTerm, 
  onSearchChange, 
  onAddWorker,
  onDropAllWorkers,
  isDropping = false
}: WorkerFiltersProps) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex space-x-4">
        <Input
          placeholder="Search workers..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-80"
        />
      </div>
      <div className="flex space-x-2">
        {onDropAllWorkers && (
          <Button
            variant="destructive"
            onClick={onDropAllWorkers}
            disabled={isDropping}
            className="flex items-center space-x-2"
          >
            <UserMinus className="h-4 w-4" />
            <span>{isDropping ? 'Dropping...' : 'Drop All Workers'}</span>
          </Button>
        )}
        <Button onClick={onAddWorker} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Worker</span>
        </Button>
      </div>
    </div>
  );
};
