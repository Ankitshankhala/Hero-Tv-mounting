
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, MapPin, Calendar, Edit } from 'lucide-react';
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
                      onClick={() => handleEditWorker(worker)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewCalendar(worker)}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Calendar Modal */}
      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedWorker?.name}'s Calendar & Schedule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <WorkerCalendar />
            <WorkerScheduleManager onScheduleUpdate={onWorkerUpdate} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Worker Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Worker: {selectedWorker?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">
                    {selectedWorker?.name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">
                    {selectedWorker?.email}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">
                    {selectedWorker?.phone || 'Not provided'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <div className="p-2 bg-gray-50 rounded border text-sm">
                    {selectedWorker?.city}, {selectedWorker?.region}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-600 mt-4">
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
