
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  const [showDropAllDialog, setShowDropAllDialog] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkers();
  }, []);

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
        description: "Failed to load workers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDropAllWorkers = async () => {
    try {
      setIsDropping(true);
      
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('role', 'worker')
        .eq('is_active', true);

      if (error) {
        console.error('Error dropping all workers:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "All workers have been deactivated successfully",
      });

      await fetchWorkers();
      setShowDropAllDialog(false);
    } catch (error) {
      console.error('Error dropping all workers:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate all workers",
        variant: "destructive",
      });
    } finally {
      setIsDropping(false);
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
          <TabsTrigger value="workers">Current Workers</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>
        
        <TabsContent value="workers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wrench className="h-5 w-5" />
                <span>Workers Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkerFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onAddWorker={() => setShowAddWorker(true)}
                onDropAllWorkers={() => setShowDropAllDialog(true)}
                isDropping={isDropping}
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

      <AlertDialog open={showDropAllDialog} onOpenChange={setShowDropAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop All Workers</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate all workers? This action will set all active workers to inactive status. This action can be reversed by reactivating individual workers later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDropping}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDropAllWorkers}
              disabled={isDropping}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDropping ? 'Dropping...' : 'Drop All Workers'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
