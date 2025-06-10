
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wrench, Phone, MapPin, Calendar } from 'lucide-react';

export const WorkersManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const workers = [
    {
      id: 'WK001',
      name: 'Alex Thompson',
      phone: '(555) 111-2222',
      regions: ['Downtown', 'East Side'],
      availability: 'available',
      todayJobs: 3,
      completedJobs: 156,
      rating: 4.8,
      joinDate: '2023-03-15'
    },
    {
      id: 'WK002',
      name: 'Maria Garcia',
      phone: '(555) 333-4444',
      regions: ['North Side', 'West End'],
      availability: 'busy',
      todayJobs: 2,
      completedJobs: 134,
      rating: 4.9,
      joinDate: '2023-05-20'
    },
    {
      id: 'WK003',
      name: 'David Lee',
      phone: '(555) 555-6666',
      regions: ['West End', 'South Side'],
      availability: 'available',
      todayJobs: 4,
      completedJobs: 89,
      rating: 4.7,
      joinDate: '2023-08-10'
    },
  ];

  const getAvailabilityBadge = (status: string) => {
    const statusConfig = {
      available: { label: 'Available', variant: 'default' as const },
      busy: { label: 'Busy', variant: 'destructive' as const },
      'off-duty': { label: 'Off Duty', variant: 'secondary' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wrench className="h-5 w-5" />
            <span>Workers Management</span>
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="off-duty">Off Duty</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-green-600 hover:bg-green-700">
              Add New Worker
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Regions</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Today's Jobs</TableHead>
                  <TableHead>Total Completed</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map((worker) => (
                  <TableRow key={worker.id}>
                    <TableCell className="font-medium">{worker.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{worker.name}</div>
                      <div className="text-sm text-gray-600">Joined {worker.joinDate}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2 text-sm">
                        <Phone className="h-3 w-3" />
                        <span>{worker.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {worker.regions.map((region) => (
                          <span key={region} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            {region}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{getAvailabilityBadge(worker.availability)}</TableCell>
                    <TableCell>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {worker.todayJobs}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{worker.completedJobs}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <span className="text-yellow-500">★</span>
                        <span className="font-medium">{worker.rating}</span>
                      </div>
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
    </div>
  );
};
