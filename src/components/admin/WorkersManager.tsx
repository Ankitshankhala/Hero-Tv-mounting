
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { AddWorkerModal } from './AddWorkerModal';
import { WorkerApplicationsManager } from './WorkerApplicationsManager';
import { WorkerFilters } from './WorkerFilters';
import { WorkerTable } from './WorkerTable';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatAdminError } from '@/utils/adminErrorMessage';
import { PageHeader } from '@/components/admin/ui/PageHeader';
import { TableSkeleton } from '@/components/admin/ui/Skeletons';

interface UncoveredWorker {
  worker_id: string;
  name: string | null;
  email: string | null;
  city: string | null;
  zip_code: string | null;
}

export const WorkersManager = () => {
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uncovered, setUncovered] = useState<UncoveredWorker[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { toast } = useToast();

  // Debounced fetch function to avoid excessive API calls
  const debouncedFetchWorkers = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(fetchWorkers, 500);
      };
    })(),
    []
  );

  const fetchUncovered = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('v_active_workers_without_coverage')
        .select('*');
      if (error) throw error;
      setUncovered((data as UncoveredWorker[]) || []);
    } catch (err) {
      console.error('Failed to load coverage-gap workers:', err);
    }
  };

  useEffect(() => {
    fetchWorkers();
    fetchUncovered();

    // Subscribe to worker availability changes
    const availabilityChannel = supabase
      .channel('worker-availability-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_availability'
        },
        () => {
          debouncedFetchWorkers();
        }
      )
      .subscribe();

    // Subscribe to worker schedule changes
    const scheduleChannel = supabase
      .channel('worker-schedule-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_schedule'
        },
        () => {
          debouncedFetchWorkers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(availabilityChannel);
      supabase.removeChannel(scheduleChannel);
    };
  }, [debouncedFetchWorkers]);

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          worker_availability(day_of_week, start_time, end_time)
        `)
        .eq('role', 'worker')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      setWorkers(data || []);
    } catch (error) {
      const info = formatAdminError(error, 'load technicians');
      console.error('[ADMIN ERROR] fetchWorkers', error, info);
      toast({
        title: info.title,
        description: info.description,
        variant: 'destructive',
        duration: 12000,
      });
    } finally {
      setLoading(false);
    }
  };

  const inactiveCount = workers.filter((w: any) => !w.is_active).length;

  const filteredWorkers = workers.filter((worker: any) => {
    const matchesSearch = worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         worker.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = showInactive ? true : worker.is_active;
    return matchesSearch && matchesActive;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="workers" className="w-full">
        <TabsList>
          <TabsTrigger value="workers">Current Technicians</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>
        
        <TabsContent value="workers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wrench className="h-5 w-5" />
                <span>Technicians Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!bannerDismissed && uncovered.length > 0 && (
                <Alert variant="default" className="mb-4 border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <AlertTitle>
                        {uncovered.length} active worker{uncovered.length === 1 ? '' : 's'} have no service-area coverage
                      </AlertTitle>
                      <AlertDescription>
                        <div className="mt-1">
                          {uncovered.map((w) => w.name || w.email || w.worker_id).join(', ')}
                        </div>
                        <div className="mt-2 text-xs">
                          They can't be matched to bookings until you set up coverage in Service Areas.
                        </div>
                      </AlertDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-amber-700 hover:bg-amber-100"
                      onClick={() => setBannerDismissed(true)}
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Alert>
              )}
              <WorkerFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onAddWorker={() => setShowAddWorker(true)}
                showInactive={showInactive}
                onShowInactiveChange={setShowInactive}
                inactiveCount={inactiveCount}
              />

              <WorkerTable 
                workers={filteredWorkers} 
                onWorkerUpdate={fetchWorkers}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="applications">
          <WorkerApplicationsManager />
        </TabsContent>
      </Tabs>

      {showAddWorker && (
        <AddWorkerModal 
          onClose={() => setShowAddWorker(false)} 
          onSuccess={fetchWorkers}
        />
      )}
    </div>
  );
};
