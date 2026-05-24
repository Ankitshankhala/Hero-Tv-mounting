
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';

interface WorkerFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onAddWorker: () => void;
  showInactive?: boolean;
  onShowInactiveChange?: (value: boolean) => void;
  inactiveCount?: number;
}

export const WorkerFilters = ({
  searchTerm,
  onSearchChange,
  onAddWorker,
  showInactive = false,
  onShowInactiveChange,
  inactiveCount = 0,
}: WorkerFiltersProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
      <Input
        placeholder="Search technicians..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1"
      />
      {onShowInactiveChange && (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Switch
            id="show-inactive-workers"
            checked={showInactive}
            onCheckedChange={onShowInactiveChange}
          />
          <Label htmlFor="show-inactive-workers" className="text-sm cursor-pointer">
            Show removed
            {!showInactive && inactiveCount > 0 && (
              <span className="text-muted-foreground ml-1">({inactiveCount} hidden)</span>
            )}
          </Label>
        </div>
      )}
      <Button
        onClick={onAddWorker}
        className="bg-green-600 hover:bg-green-700"
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Add New Technician
      </Button>
    </div>
  );
};
