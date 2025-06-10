
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Edit, Clock } from 'lucide-react';

export const ServicesManager = () => {
  const services = [
    {
      id: 'SV001',
      name: 'TV Mounting',
      basePrice: '$99',
      duration: '60 min',
      bufferTime: '15 min',
      totalTime: '75 min',
      description: 'Professional TV wall mounting service'
    },
    {
      id: 'SV002',
      name: 'Hide Cables (Add-on)',
      basePrice: '$50',
      duration: '30 min',
      bufferTime: '15 min',
      totalTime: '45 min',
      description: 'Conceal TV cables for clean look'
    },
    {
      id: 'SV003',
      name: 'TV Mounting + Hide Cables',
      basePrice: '$149',
      duration: '90 min',
      bufferTime: '15 min',
      totalTime: '105 min',
      description: 'Complete TV mounting with cable management'
    },
    {
      id: 'SV004',
      name: 'Sound Bar Installation',
      basePrice: '$75',
      duration: '45 min',
      bufferTime: '15 min',
      totalTime: '60 min',
      description: 'Professional sound bar mounting and setup'
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Services Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <Input
              placeholder="Search services..."
              className="max-w-md"
            />
            <Button className="bg-green-600 hover:bg-green-700">
              Add New Service
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service ID</TableHead>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Buffer Time</TableHead>
                  <TableHead>Total Time</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.id}</TableCell>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-green-600 font-medium">{service.basePrice}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span>{service.duration}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        {service.bufferTime}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                        {service.totalTime}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-gray-600 truncate">{service.description}</p>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Time Calculation Logic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Service Duration</h4>
                  <p className="text-blue-700">Actual time needed for the service work</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Buffer Time</h4>
                  <p className="text-yellow-700">Extra time for setup, cleanup, and travel</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Total Time Block</h4>
                  <p className="text-green-700">Complete time slot reserved for booking</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};
