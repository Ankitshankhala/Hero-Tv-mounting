
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

interface ServicesSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onAddService: () => void;
}

export const ServicesSearch: React.FC<ServicesSearchProps> = ({
  searchTerm,
  onSearchChange,
  onAddService
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <Input
        placeholder="Search services..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-md"
      />
      <Button 
        onClick={onAddService}
        className="bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-lg px-6 py-2 flex items-center space-x-2"
      >
        <Plus className="h-4 w-4" />
        <span>Add New Service</span>
      </Button>
    </div>
  );
};
