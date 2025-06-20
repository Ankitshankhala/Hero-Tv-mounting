
import React from 'react';
import { Input } from '@/components/ui/input';

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
    </div>
  );
};
