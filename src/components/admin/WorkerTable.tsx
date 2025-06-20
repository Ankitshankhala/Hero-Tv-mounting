
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Phone, MapPin, Calendar, Edit, MoreVertical, UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import WorkerCalendar from '@/components/worker/WorkerCalendar';
import WorkerScheduleManager from '@/components/worker/WorkerScheduleManager';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city: string;
  region: string;
  is_active: boolean;
  created_at: string;
  worker_availability?: any[];
}

interface WorkerTableProps {
  workers: Worker[];
  onWorkerUpdate?: () => void;
}

export const WorkerTable = ({ workers, onWorkerUpdate }: WorkerTableProps) => {
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [removingWorkerId, setRemovingWorkerId] = useState<string | null>(null);
  const { toast } = useToast();

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

  const handleEditWorker = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowEditModal(true);
  };

  const handleViewCalendar = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowCalendar(true);
  };

  const handleRemoveWorker = async (workerId: string) => {
    try {
      setRemovingWorkerId(workerId);
      
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', workerId);

      if (error) {
        console.error('Error removing worker:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Worker has been removed successfully",
      });

      if (onWorkerUpdate) {
        onWorkerUpdate();
      }
    } catch (error) {
      console.error('Error removing worker:', error);
      toast({
        title: "Error",
        description: "Failed to remove worker",
        variant: "destructive",
      });
    } finally {
      setRemovingWorkerId(null);
    }
  };

  const closeModals = () => {
    setShowCalendar(false);
    setShowEditModal(false);
    setSelectedWorker(null);
  };

  return (
    <>
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
            {workers.map((worker) => (
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
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewCalendar(worker)}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditWorker(worker)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        {worker.is_active && (
                          <DropdownMenuItem 
                            onClick={() => handleRemoveWorker(worker.id)}
                            disabled={removingWorkerId === worker.id}
                            className="text-red-600 hover:text-red-700 focus:text-red-700"
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            {removingWorkerId === worker.id ? 'Removing...' : 'Remove Worker'}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Calendar Modal */}
      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-foreground text-xl font-semibold">
              {selectedWorker?.name}'s Calendar & Schedule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Calendar Section */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-lg shadow-sm">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-card-foreground">Jobs Calendar</h3>
                    <p className="text-sm text-muted-foreground">View scheduled jobs and appointments</p>
                  </div>
                  <div className="p-4">
                    <WorkerCalendar />
                  </div>
                </div>
              </div>
              
              {/* Schedule Manager Section */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-lg shadow-sm">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-card-foreground">Availability Schedule</h3>
                    <p className="text-sm text-muted-foreground">Manage working hours and availability</p>
                  </div>
                  <div className="p-4">
                    <WorkerScheduleManager onScheduleUpdate={onWorkerUpdate} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Worker Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Worker: {selectedWorker?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Name</label>
                  <div className="p-2 bg-muted rounded border text-sm text-foreground">
                    {selectedWorker?.name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Email</label>
                  <div className="p-2 bg-muted rounded border text-sm text-foreground">
                    {selectedWorker?.email}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Phone</label>
                  <div className="p-2 bg-muted rounded border text-sm text-foreground">
                    {selectedWorker?.phone || 'Not provided'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Location</label>
                  <div className="p-2 bg-muted rounded border text-sm text-foreground">
                    {selectedWorker?.city}, {selectedWorker?.region}
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground mt-4">
                <p><strong>Note:</strong> Worker profile editing is currently view-only. Contact system administrator for changes.</p>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={closeModals}>Close</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
