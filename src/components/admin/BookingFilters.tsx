
import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BookingFiltersProps {
  searchTerm: string;
  filterStatus: string;
  filterRegion: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRegionChange: (value: string) => void;
}

export const BookingFilters = ({
  searchTerm,
  filterStatus,
  filterRegion,
  onSearchChange,
  onStatusChange,
  onRegionChange
}: BookingFiltersProps) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <Input
        placeholder="Search bookings..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1"
      />
      <Select value={filterStatus} onValueChange={onStatusChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="confirmed">Confirmed</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterRegion} onValueChange={onRegionChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Filter by region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          <SelectItem value="downtown">Downtown</SelectItem>
          <SelectItem value="north-side">North Side</SelectItem>
          <SelectItem value="west-end">West End</SelectItem>
          <SelectItem value="east-side">East Side</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
