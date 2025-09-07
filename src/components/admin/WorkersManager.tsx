
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench } from 'lucide-react';
import { AddWorkerModal } from './AddWorkerModal';
import { WorkerApplicationsManager } from './WorkerApplicationsManager';
import { WorkerFilters } from './WorkerFilters';
import { WorkerTable } from './WorkerTable';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const WorkersManager = () => {
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchWorkers();

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
      console.error('Error fetching workers:', error);
      toast({
        title: "Error",
        description: "Failed to load technicians",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         worker.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
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
              <WorkerFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onAddWorker={() => setShowAddWorker(true)}
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
