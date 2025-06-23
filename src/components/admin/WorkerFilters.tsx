
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

interface WorkerFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onAddWorker: () => void;
}

export const WorkerFilters = ({
  searchTerm,
  onSearchChange,
  onAddWorker
}: WorkerFiltersProps) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <Input
        placeholder="Search workers..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1"
      />
      <Button 
        onClick={onAddWorker}
        className="bg-green-600 hover:bg-green-700"
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Add New Worker
      </Button>
    </div>
  );
};
