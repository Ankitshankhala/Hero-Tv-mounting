
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench } from 'lucide-react';
import { AddWorkerModal } from './AddWorkerModal';
import { WorkerApplicationsManager } from './WorkerApplicationsManager';
import { WorkerFilters } from './WorkerFilters';
import { WorkerTable } from './WorkerTable';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import GoogleCalendarIntegration from '@/components/GoogleCalendarIntegration';

export const WorkersManager = () => {
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
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
      {/* Google Calendar Integration Card */}
      <GoogleCalendarIntegration 
        onConnectionChange={(connected) => setIsCalendarConnected(connected)}
      />

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
                {isCalendarConnected && (
                  <Badge variant="default" className="bg-green-600">
                    Calendar Connected
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkerFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onAddWorker={() => setShowAddWorker(true)}
              />

              <WorkerTable workers={filteredWorkers} />
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
          onWorkerAdded={fetchWorkers}
        />
      )}
    </div>
  );
};
