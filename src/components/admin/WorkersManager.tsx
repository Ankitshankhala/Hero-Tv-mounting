
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Wrench, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AddWorkerModal } from './AddWorkerModal';
import { WorkerApplicationsManager } from './WorkerApplicationsManager';
import { WorkerTable } from './WorkerTable';
import { WorkerFilters } from './WorkerFilters';

export const WorkersManager = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    region: '',
    search: ''
  });

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'worker')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching workers:', error);
        return;
      }

      setWorkers(data || []);
    } catch (error) {
      console.error('Error in fetchWorkers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerAdded = () => {
    fetchWorkers();
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesStatus = filters.status === 'all' || 
      (filters.status === 'active' && worker.is_active) ||
      (filters.status === 'inactive' && !worker.is_active);
    
    const matchesRegion = !filters.region || worker.region === filters.region;
    
    const matchesSearch = !filters.search || 
      worker.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      worker.email.toLowerCase().includes(filters.search.toLowerCase());

    return matchesStatus && matchesRegion && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Workers Management</h2>
          <p className="text-gray-600">Manage your technicians and their availability</p>
        </div>
        <Button onClick={() => setShowAddWorker(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Worker
        </Button>
      </div>

      <Tabs defaultValue="workers" className="w-full">
        <TabsList>
          <TabsTrigger value="workers" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Workers</span>
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center space-x-2">
            <Wrench className="h-4 w-4" />
            <span>Applications</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Active Workers ({filteredWorkers.length})</span>
                <Badge variant="outline">{workers.length} Total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkerFilters 
                filters={filters}
                onFiltersChange={setFilters}
                workers={workers}
              />
              <WorkerTable 
                workers={filteredWorkers}
                loading={loading}
                onRefresh={fetchWorkers}
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
          onWorkerAdded={handleWorkerAdded}
        />
      )}
    </div>
  );
};
