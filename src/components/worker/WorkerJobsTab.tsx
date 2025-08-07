
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpandableJobCardContainer } from './ExpandableJobCardContainer';
import { JobFiltersBar } from './JobFiltersBar';
import { useJobFilters } from '@/hooks/useJobFilters';
import { User } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface WorkerJobsTabProps {
  jobs: any[];
  onStatusUpdate: (jobId: string, newStatus: BookingStatus) => void;
  onJobCancelled: () => void;
}

const WorkerJobsTab = ({ jobs, onStatusUpdate, onJobCancelled }: WorkerJobsTabProps) => {
  const {
    filters,
    filteredJobs,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    filterSummary,
    debouncedSearch
  } = useJobFilters(jobs);

  // Get available filter options from jobs data
  const availableStatuses = useMemo(() => {
    const statuses = [...new Set(jobs.map(job => job.status))];
    return statuses.sort();
  }, [jobs]);

  const availableServices = useMemo(() => {
    const services = new Set<string>();
    jobs.forEach(job => {
      if (job.booking_services) {
        job.booking_services.forEach((service: any) => {
          services.add(service.service_name);
        });
      }
    });
    return Array.from(services).sort();
  }, [jobs]);

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <JobFiltersBar
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        onSearchChange={debouncedSearch}
        hasActiveFilters={hasActiveFilters}
        filterSummary={filterSummary}
        availableStatuses={availableStatuses}
        availableServices={availableServices}
      />

      {/* Jobs List */}
      <Card className="bg-worker-card border-worker-border shadow-lg">
        <CardHeader className="bg-gradient-to-r from-worker-card to-worker-card-hover border-b border-worker-border">
          <CardTitle className="text-worker-card-foreground text-xl font-semibold">
            My Jobs
            {filterSummary.filtered !== filterSummary.total && (
              <span className="text-worker-muted text-base font-normal ml-2">
                ({filterSummary.filtered} of {filterSummary.total})
              </span>
            )}
          </CardTitle>
          <p className="text-worker-muted text-sm">Manage your assigned jobs and track progress</p>
        </CardHeader>
        <CardContent className="p-6">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-worker-border/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-worker-muted" />
              </div>
              {jobs.length === 0 ? (
                <>
                  <p className="text-worker-muted text-lg mb-2">No jobs assigned yet</p>
                  <p className="text-worker-muted/70 text-sm">Check back later for new job assignments</p>
                </>
              ) : (
                <>
                  <p className="text-worker-muted text-lg mb-2">No jobs match your filters</p>
                  <p className="text-worker-muted/70 text-sm">Try adjusting your filter criteria</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job) => (
                <ExpandableJobCardContainer
                  key={job.id}
                  job={job}
                  onStatusUpdate={onStatusUpdate}
                  onJobCancelled={onJobCancelled}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerJobsTab;
