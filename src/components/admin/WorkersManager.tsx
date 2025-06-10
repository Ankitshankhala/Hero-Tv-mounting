import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench, Phone, MapPin, Calendar, UserPlus } from 'lucide-react';
import { AddWorkerModal } from './AddWorkerModal';
import { WorkerApplicationsManager } from './WorkerApplicationsManager';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import GoogleCalendarIntegration from '@/components/GoogleCalendarIntegration';

export const WorkersManager = () => {
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
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

  const getAvailabilityBadge = (workerAvailability: any[]) => {
    if (!workerAvailability || workerAvailability.length === 0) {
      return <Badge variant="secondary">Not Set</Badge>;
    }
    return <Badge variant="default">Available</Badge>;
  };

  const formatAvailability = (workerAvailability: any[]) => {
    if (!workerAvailability || workerAvailability.length === 0) {
      return 'Not specified';
    }
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const availableDays = workerAvailability.map(a => days[a.day_of_week]);
    return availableDays.join(', ');
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
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <Input
                  placeholder="Search workers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={() => setShowAddWorker(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add New Worker
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkers.map((worker) => (
                      <TableRow key={worker.id}>
                        <TableCell>
                          <div className="font-medium">{worker.name}</div>
                          <div className="text-sm text-gray-600">{worker.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 text-sm">
                            <Phone className="h-3 w-3" />
                            <span>{worker.phone || 'Not provided'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 text-sm">
                            <MapPin className="h-3 w-3" />
                            <span>{worker.city}, {worker.region}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {getAvailabilityBadge(worker.worker_availability)}
                            <div className="text-xs text-gray-600 mt-1">
                              {formatAvailability(worker.worker_availability)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={worker.is_active ? 'default' : 'secondary'}>
                            {worker.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {new Date(worker.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                            <Button variant="outline" size="sm">
                              <Calendar className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
