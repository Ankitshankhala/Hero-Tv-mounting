import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, Filter, X, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { JobFilters } from '@/hooks/useJobFilters';
interface JobFiltersBarProps {
  filters: JobFilters;
  onFilterChange: (key: keyof JobFilters, value: any) => void;
  onClearFilters: () => void;
  onSearchChange: (term: string) => void;
  hasActiveFilters: boolean;
  filterSummary: {
    total: number;
    filtered: number;
    showing: number;
  };
  availableStatuses: string[];
  availableServices: string[];
}
export const JobFiltersBar = ({
  filters,
  onFilterChange,
  onClearFilters,
  onSearchChange,
  hasActiveFilters,
  filterSummary,
  availableStatuses,
  availableServices
}: JobFiltersBarProps) => {
  const handleStatusToggle = (status: string, checked: boolean) => {
    const newStatuses = checked ? [...filters.statuses, status] : filters.statuses.filter(s => s !== status);
    onFilterChange('statuses', newStatuses);
  };
  const handleServiceToggle = (service: string, checked: boolean) => {
    const newServices = checked ? [...filters.serviceTypes, service] : filters.serviceTypes.filter(s => s !== service);
    onFilterChange('serviceTypes', newServices);
  };
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
        return 'bg-status-confirmed text-white';
      case 'in_progress':
        return 'bg-status-progress text-white';
      case 'completed':
        return 'bg-status-completed text-white';
      case 'cancelled':
        return 'bg-status-cancelled text-white';
      default:
        return 'bg-status-pending text-white';
    }
  };
  return <Card className="bg-worker-card border-worker-border mb-6">
      <CardContent className="p-4 space-y-4">
        {/* Search and Primary Controls */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-worker-muted" />
            <Input placeholder="Search jobs by customer, address, or service..." className="pl-10 bg-background text-foreground border-worker-border" onChange={e => onSearchChange(e.target.value)} defaultValue={filters.searchTerm} />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 min-w-0 lg:min-w-[200px]">
            <Clock className="h-4 w-4 text-worker-muted flex-shrink-0" />
            <Select value={filters.sortBy} onValueChange={value => onFilterChange('sortBy', value)}>
              <SelectTrigger className="bg-background border-worker-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="earliest">Earliest Jobs First</SelectItem>
                <SelectItem value="latest">Latest Jobs First</SelectItem>
                <SelectItem value="newest">Newest Created</SelectItem>
                <SelectItem value="oldest">Oldest Created</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Last Job Toggle */}
          
        </div>

        {/* Status Filters */}
        {availableStatuses.length > 0 && <div className="space-y-2">
            
            <div className="flex flex-wrap gap-2">
              {availableStatuses.map(status => <div key={status} className="flex items-center gap-2">
                  <Checkbox id={`status-${status}`} checked={filters.statuses.includes(status)} onCheckedChange={checked => handleStatusToggle(status, !!checked)} />
                  <Label htmlFor={`status-${status}`} className="text-sm text-worker-card-foreground cursor-pointer">
                    <Badge variant="outline" className={getStatusColor(status)}>
                      {status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </Label>
                </div>)}
            </div>
          </div>}

        {/* Service Type Filters */}
        {availableServices.length > 0 && <div className="space-y-2">
            <Label className="text-sm font-medium text-worker-card-foreground">
              Service Types
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableServices.map(service => <div key={service} className="flex items-center gap-2">
                  <Checkbox id={`service-${service}`} checked={filters.serviceTypes.includes(service)} onCheckedChange={checked => handleServiceToggle(service, !!checked)} />
                  <Label htmlFor={`service-${service}`} className="text-sm text-worker-card-foreground cursor-pointer">
                    {service}
                  </Label>
                </div>)}
            </div>
          </div>}

        {/* Filter Summary and Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-worker-border">
          <div className="flex items-center gap-4">
            <div className="text-sm text-worker-muted">
              Showing {filterSummary.showing} of {filterSummary.total} jobs
            </div>
            {hasActiveFilters && <Badge variant="secondary" className="bg-primary text-primary-foreground">
                {filters.statuses.length + filters.serviceTypes.length + (filters.afterLastJob ? 1 : 0) + (filters.searchTerm ? 1 : 0)} filters active
              </Badge>}
          </div>
          
          {hasActiveFilters && <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-worker-muted hover:text-worker-card-foreground">
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>}
        </div>
      </CardContent>
    </Card>;
};