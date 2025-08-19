import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { TestTube } from 'lucide-react';

interface BookingFiltersProps {
  searchTerm: string;
  filterStatus: string;
  filterRegion: string;
  archiveFilter: string;
  includeArchived: boolean;
  testingFilter: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onArchiveFilterChange: (value: string) => void;
  onIncludeArchivedChange: (value: boolean) => void;
  onTestingFilterChange: (value: boolean) => void;
}

export const BookingFilters = ({
  searchTerm,
  filterStatus,
  filterRegion,
  archiveFilter,
  includeArchived,
  testingFilter,
  onSearchChange,
  onStatusChange,
  onRegionChange,
  onArchiveFilterChange,
  onIncludeArchivedChange,
  onTestingFilterChange
}: BookingFiltersProps) => {
  return (
    <div className="space-y-4 mb-6">
      {/* Booking Filter Tabs */}
      <Tabs value={archiveFilter} onValueChange={onArchiveFilterChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">All Bookings</TabsTrigger>
          <TabsTrigger value="pending_payments">Pending Payments</TabsTrigger>
          <TabsTrigger value="archived">Archived Bookings</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Quick filters for All Bookings tab only */}
      {archiveFilter === 'active' && (
        <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <Switch
              id="include-archived"
              checked={includeArchived}
              onCheckedChange={onIncludeArchivedChange}
            />
            <Label htmlFor="include-archived" className="text-sm">Include archived</Label>
          </div>
          
          <Button
            variant={testingFilter ? "default" : "outline"}
            size="sm"
            onClick={() => onTestingFilterChange(!testingFilter)}
            className="h-8"
          >
            <TestTube className="h-3 w-3 mr-2" />
            Testing ($1-5)
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by customer name, booking ID, service, or worker..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        
        <Select value={filterStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterRegion} onValueChange={onRegionChange}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            <SelectItem value="austin">Austin</SelectItem>
            <SelectItem value="dallas">Dallas</SelectItem>
            <SelectItem value="houston">Houston</SelectItem>
            <SelectItem value="san antonio">San Antonio</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};