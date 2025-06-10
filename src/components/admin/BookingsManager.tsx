
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Calendar, Filter } from 'lucide-react';

export const BookingsManager = () => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const bookings = [
    {
      id: 'BK001',
      customer: 'John Smith',
      service: 'TV Mounting + Hide Cables',
      duration: '1hr 30min',
      date: '2024-01-15',
      time: '2:00 PM',
      region: 'Downtown',
      worker: 'Alex Thompson',
      status: 'confirmed',
      price: '$149'
    },
    {
      id: 'BK002',
      customer: 'Sarah Johnson',
      service: 'TV Mounting',
      duration: '1hr 15min',
      date: '2024-01-15',
      time: '4:00 PM',
      region: 'North Side',
      worker: 'Maria Garcia',
      status: 'in-progress',
      price: '$99'
    },
    {
      id: 'BK003',
      customer: 'Mike Davis',
      service: 'TV Mounting + Hide Cables',
      duration: '1hr 30min',
      date: '2024-01-15',
      time: '10:00 AM',
      region: 'West End',
      worker: 'David Lee',
      status: 'completed',
      price: '$149'
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in-progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Bookings Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search bookings..."
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
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="downtown">Downtown</SelectItem>
                <SelectItem value="north-side">North Side</SelectItem>
                <SelectItem value="west-end">West End</SelectItem>
                <SelectItem value="east-side">East Side</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.id}</TableCell>
                    <TableCell>{booking.customer}</TableCell>
                    <TableCell>{booking.service}</TableCell>
                    <TableCell>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {booking.duration}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{booking.date}</div>
                        <div className="text-sm text-gray-600">{booking.time}</div>
                      </div>
                    </TableCell>
                    <TableCell>{booking.region}</TableCell>
                    <TableCell>{booking.worker}</TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell className="font-medium">{booking.price}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
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
