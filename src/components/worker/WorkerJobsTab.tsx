import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ExpandableJobCardContainer } from './ExpandableJobCardContainer';
import { JobFiltersBar } from './JobFiltersBar';
import { useJobFilters } from '@/hooks/useJobFilters';
import { Calendar, Briefcase, Archive } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface WorkerJobsTabProps {
  jobs: any[];
  onStatusUpdate: (jobId: string, newStatus: BookingStatus) => void;
  onJobCancelled: () => void;
}

export const WorkerJobsTab = ({ jobs, onStatusUpdate, onJobCancelled }: WorkerJobsTabProps) => {
  // Active jobs: exclude archived, completed/canceled statuses and cancelled/failed/refunded payments
  const activeJobs = useMemo(() => 
    jobs.filter(job => 
      !job.is_archived && 
      job.status !== 'completed' &&
      job.status !== 'cancelled' &&
      job.status !== 'canceled' &&
      !['cancelled','canceled','failed','refunded'].includes(job.payment_status) &&
      job.worker_id // Only show jobs with assigned workers
    ), [jobs]);
  const archivedJobs = useMemo(() => jobs.filter(job => job.is_archived), [jobs]);
  
  // Payment issues: only pending payments that need collection (exclude captured, cancelled, failed)
  const paymentIssueJobs = useMemo(() => 
    jobs.filter(job => 
      !job.is_archived && 
      job.status !== 'completed' &&
      job.status !== 'cancelled' &&
      job.payment_status === 'pending' &&
      job.worker_id // Only show assigned jobs
    ), [jobs]);

  // Use the job filters hook for both active and archived jobs
  const activeFilters = useJobFilters(activeJobs);
  const archivedFilters = useJobFilters(archivedJobs);

  // Memoize filter options for performance
  const availableStatuses = useMemo(() => {
    const statuses = Array.from(new Set(jobs.map(job => job.status).filter(Boolean)));
    return statuses.sort();
  }, [jobs]);

  const availableServices = useMemo(() => {
    const services = Array.from(new Set(jobs.flatMap(job => 
      job.booking_services?.map(service => service.service_name) || []
    ).filter(Boolean)));
    return services.sort();
  }, [jobs]);

  const renderJobsList = (filteredJobs: any[], filters: any, updateFilter: any, clearFilters: any, debouncedSearch: any, hasActiveFilters: boolean, filterSummary: any, isArchived = false) => (
    <div className="space-y-6">
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

      <Card className="bg-worker-card border-worker-border shadow-lg">
        <CardHeader 
          id={!isArchived ? "active-jobs-section" : undefined}
          className="bg-gradient-to-r from-worker-card to-worker-card-hover border-b border-worker-border scroll-mt-24"
        >
          <CardTitle className="text-worker-card-foreground text-xl font-semibold">
            {isArchived ? 'Archived Jobs' : 'Active Jobs'}
            {filterSummary.filtered !== filterSummary.total && (
              <span className="text-worker-muted text-base font-normal ml-2">
                ({filterSummary.filtered} of {filterSummary.total})
              </span>
            )}
          </CardTitle>
          <p className="text-worker-muted text-sm">
            {isArchived ? 'View completed and archived jobs' : 'Manage your active job assignments'}
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-worker-border/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                {isArchived ? <Archive className="h-8 w-8 text-worker-muted" /> : <Calendar className="h-8 w-8 text-worker-muted" />}
              </div>
              <p className="text-worker-muted text-lg mb-2">
                {isArchived ? 'No archived jobs' : 'No active jobs'}
              </p>
              <p className="text-worker-muted/70 text-sm">
                {isArchived 
                  ? 'Completed and archived jobs will appear here'
                  : 'Check back later for new job assignments'
                }
              </p>
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

  return (
    <div className="space-y-6">
      {/* Payment Issues Section */}
      {paymentIssueJobs.length > 0 && (
        <Card className="bg-destructive/5 border-destructive/20 shadow-lg">
          <CardHeader className="bg-destructive/10 border-b border-destructive/20">
            <CardTitle className="text-destructive text-xl font-semibold flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Payment Issues ({paymentIssueJobs.length})
            </CardTitle>
            <p className="text-destructive/80 text-sm">
              These jobs require payment collection before work can proceed
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {paymentIssueJobs.map((job) => (
                <ExpandableJobCardContainer
                  key={job.id}
                  job={job}
                  onStatusUpdate={onStatusUpdate}
                  onJobCancelled={onJobCancelled}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" className="flex items-center space-x-2">
            <Briefcase className="h-4 w-4" />
            <span>Active Jobs ({activeJobs.length})</span>
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center space-x-2">
            <Archive className="h-4 w-4" />
            <span>Archived Jobs ({archivedJobs.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {renderJobsList(
            activeFilters.filteredJobs,
            activeFilters.filters,
            activeFilters.updateFilter,
            activeFilters.clearFilters,
            activeFilters.debouncedSearch,
            activeFilters.hasActiveFilters,
            activeFilters.filterSummary,
            false
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          {renderJobsList(
            archivedFilters.filteredJobs,
            archivedFilters.filters,
            archivedFilters.updateFilter,
            archivedFilters.clearFilters,
            archivedFilters.debouncedSearch,
            archivedFilters.hasActiveFilters,
            archivedFilters.filterSummary,
            true
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkerJobsTab;