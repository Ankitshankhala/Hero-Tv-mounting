
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { X, User, MapPin, Clock } from 'lucide-react';

interface AssignWorkerModalProps {
  onClose: () => void;
}

export const AssignWorkerModal = ({ onClose }: AssignWorkerModalProps) => {
  const [selectedBooking, setSelectedBooking] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');

  const unassignedBookings = [
    { id: 'BK005', customer: 'Jennifer Wilson', service: 'TV Mounting', time: '10:00 AM', region: 'Downtown' },
    { id: 'BK006', customer: 'Robert Brown', service: 'TV + Cables', time: '2:00 PM', region: 'North Side' },
  ];

  const availableWorkers = [
    { id: 'alex', name: 'Alex Thompson', regions: ['Downtown', 'East Side'], availability: 'Available' },
    { id: 'maria', name: 'Maria Garcia', regions: ['North Side', 'West End'], availability: 'Available' },
    { id: 'david', name: 'David Lee', regions: ['West End', 'South Side'], availability: 'Busy (2 jobs)' },
  ];

  const handleAssign = () => {
    console.log('Assigning worker:', selectedWorker, 'to booking:', selectedBooking);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Assign Worker to Booking</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Label className="text-base font-medium mb-3 block">Unassigned Bookings</Label>
            <div className="space-y-3">
              {unassignedBookings.map((booking) => (
                <Card 
                  key={booking.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedBooking === booking.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedBooking(booking.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{booking.customer}</p>
                        <p className="text-sm text-gray-600">{booking.service}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{booking.time}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3" />
                            <span>{booking.region}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        {booking.id}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-base font-medium mb-3 block">Available Workers</Label>
            <div className="space-y-3">
              {availableWorkers.map((worker) => (
                <Card 
                  key={worker.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedWorker === worker.id ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedWorker(worker.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <p className="font-medium">{worker.name}</p>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {worker.regions.map((region) => (
                            <span key={region} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {region}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        worker.availability === 'Available' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {worker.availability}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="flex space-x-4 mt-6 pt-4 border-t">
          <Button 
            onClick={handleAssign} 
            disabled={!selectedBooking || !selectedWorker}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            Assign Worker
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
