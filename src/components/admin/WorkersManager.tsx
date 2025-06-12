
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
  const [searchTerm, setSearchTerm] = useState('');

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
    if (!searchTerm) return true;
    
    return worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           worker.email.toLowerCase().includes(searchTerm.toLowerCase());
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
          onWorkerAdded={handleWorkerAdded}
        />
      )}
    </div>
  );
};
