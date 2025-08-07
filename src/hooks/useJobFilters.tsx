import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export interface JobFilters {
  afterLastJob: boolean;
  sortBy: 'earliest' | 'latest' | 'newest' | 'oldest';
  statuses: string[];
  searchTerm: string;
  serviceTypes: string[];
}

const defaultFilters: JobFilters = {
  afterLastJob: false,
  sortBy: 'earliest',
  statuses: [],
  searchTerm: '',
  serviceTypes: []
};

export const useJobFilters = (jobs: any[]) => {
  const [filters, setFilters] = useState<JobFilters>(defaultFilters);
  
  // Get last job timestamp for filtering
  const getLastJobTimestamp = useCallback((jobs: any[]) => {
    const completedOrAssigned = jobs.filter(job => 
      ['completed', 'scheduled', 'in_progress'].includes(job.status)
    );
    
    if (completedOrAssigned.length === 0) return null;
    
    return Math.max(...completedOrAssigned.map(job => 
      new Date(job.updated_at || job.created_at).getTime()
    ));
  }, []);

  // Debounced search term
  const { debouncedCallback: debouncedSearch } = useDebounce(
    (searchTerm: string) => {
      setFilters(prev => ({ ...prev, searchTerm }));
    },
    300
  );

  // Filter and sort jobs
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Filter by last job timestamp
    if (filters.afterLastJob) {
      const lastJobTime = getLastJobTimestamp(jobs);
      if (lastJobTime) {
        result = result.filter(job => {
          const jobTime = new Date(job.updated_at || job.created_at).getTime();
          return jobTime > lastJobTime;
        });
      }
    }

    // Filter by status
    if (filters.statuses.length > 0) {
      result = result.filter(job => filters.statuses.includes(job.status));
    }

    // Filter by service types
    if (filters.serviceTypes.length > 0) {
      result = result.filter(job => {
        const jobServices = job.booking_services?.map((s: any) => s.service_name) || [];
        return filters.serviceTypes.some(type => jobServices.includes(type));
      });
    }

    // Filter by search term
    if (filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(job => {
        const customerName = (job.guest_customer_info?.name || job.customer?.name || '').toLowerCase();
        const address = (job.guest_customer_info?.address || job.customer_address || '').toLowerCase();
        const serviceNames = job.booking_services?.map((s: any) => s.service_name.toLowerCase()).join(' ') || '';
        
        return customerName.includes(searchLower) || 
               address.includes(searchLower) || 
               serviceNames.includes(searchLower);
      });
    }

    // Sort jobs
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'earliest':
          return new Date(`${a.scheduled_date} ${a.scheduled_start}`).getTime() - 
                 new Date(`${b.scheduled_date} ${b.scheduled_start}`).getTime();
        case 'latest':
          return new Date(`${b.scheduled_date} ${b.scheduled_start}`).getTime() - 
                 new Date(`${a.scheduled_date} ${a.scheduled_start}`).getTime();
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [jobs, filters, getLastJobTimestamp]);

  // Update individual filters
  const updateFilter = useCallback((key: keyof JobFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.afterLastJob || 
           filters.statuses.length > 0 || 
           filters.searchTerm.trim() !== '' ||
           filters.serviceTypes.length > 0 ||
           filters.sortBy !== 'earliest';
  }, [filters]);

  // Get filter summary
  const filterSummary = useMemo(() => {
    const total = jobs.length;
    const filtered = filteredJobs.length;
    return { total, filtered, showing: filtered };
  }, [jobs.length, filteredJobs.length]);

  return {
    filters,
    filteredJobs,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    filterSummary,
    debouncedSearch
  };
};