
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, MapPin, Calendar } from 'lucide-react';

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
}

export const WorkerTable = ({ workers }: WorkerTableProps) => {
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

  return (
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
  );
};
