import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ExpandableJobCardContainer } from './ExpandableJobCardContainer';
import { JobFiltersBar } from './JobFiltersBar';
import { useJobFilters } from '@/hooks/useJobFilters';
import { Calendar, Briefcase, Archive } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { convertUTCToLocal } from '@/utils/timeUtils';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface WorkerJobsTabProps {
  jobs: any[];
  onStatusUpdate: (jobId: string, newStatus: BookingStatus) => void;
  onJobCancelled: () => void;
  initialTab?: string;
}

export const WorkerJobsTab = ({ jobs, onStatusUpdate, onJobCancelled, initialTab = "active" }: WorkerJobsTabProps) => {
  // Active jobs: exclude archived, completed/canceled statuses and completed payments
  const activeJobs = useMemo(() => {
    const filtered = jobs.filter(job => 
      !job.is_archived && 
      job.status !== 'completed' &&
      job.status !== 'cancelled' &&
      job.status !== 'canceled' &&
      // Exclude jobs with captured/completed payments (these are effectively completed)
      !['captured', 'completed', 'cancelled','canceled','failed','refunded'].includes(job.payment_status) &&
      job.worker_id // Only show jobs with assigned workers
    );

    // Sort jobs: today's jobs first by start time, then others by creation time
    return filtered.sort((a, b) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get job start times
      const getJobStartTime = (job: any) => {
        if (job.preferred_start_time) {
          return new Date(job.preferred_start_time);
        }
        if (job.start_time) {
          return new Date(job.start_time);
        }
        if (job.preferred_date && job.preferred_time) {
          const serviceTimezone = job.service?.timezone || 'America/Chicago';
          try {
            const localDateTime = convertUTCToLocal(
              new Date(`${job.preferred_date}T${job.preferred_time}`), 
              serviceTimezone
            );
            return new Date(`${localDateTime.date}T${localDateTime.time}`);
          } catch {
            return new Date(`${job.preferred_date}T${job.preferred_time}`);
          }
        }
        return null;
      };

      const aStartTime = getJobStartTime(a);
      const bStartTime = getJobStartTime(b);
      
      // Check if jobs are today
      const aIsToday = aStartTime && aStartTime >= today && aStartTime < new Date(today.getTime() + 86400000);
      const bIsToday = bStartTime && bStartTime >= today && bStartTime < new Date(today.getTime() + 86400000);
      
      // Today's jobs first
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      
      // Both today: sort by start time (earliest first)
      if (aIsToday && bIsToday && aStartTime && bStartTime) {
        return aStartTime.getTime() - bStartTime.getTime();
      }
      
      // Both not today: sort by creation time (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [jobs]);
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
      {/* Filters hidden per request */}

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
      
      <Tabs defaultValue={initialTab} className="w-full">
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