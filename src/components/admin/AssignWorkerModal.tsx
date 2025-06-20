
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { X, User, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AssignWorkerModalProps {
  onClose: () => void;
  onAssignmentComplete?: () => void;
}

interface UnassignedBooking {
  id: string;
  customer: {
    name: string;
    city?: string;
  };
  service: {
    name: string;
  };
  scheduled_date: string;
  scheduled_start: string;
}

interface AvailableWorker {
  id: string;
  name: string;
  city?: string;
  phone?: string;
  email: string;
}

export const AssignWorkerModal = ({ onClose, onAssignmentComplete }: AssignWorkerModalProps) => {
  const [selectedBooking, setSelectedBooking] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [unassignedBookings, setUnassignedBookings] = useState<UnassignedBooking[]>([]);
  const [availableWorkers, setAvailableWorkers] = useState<AvailableWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch unassigned bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          scheduled_date,
          scheduled_start,
          customer:users!customer_id(name, city),
          service:services(name)
        `)
        .is('worker_id', null)
        .eq('status', 'pending')
        .order('scheduled_date', { ascending: true });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      // Fetch available workers
      const { data: workersData, error: workersError } = await supabase
        .from('users')
        .select('id, name, city, phone, email')
        .eq('role', 'worker')
        .eq('is_active', true)
        .order('name');

      if (workersError) {
        console.error('Error fetching workers:', workersError);
        throw workersError;
      }

      setUnassignedBookings(bookingsData || []);
      setAvailableWorkers(workersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedBooking || !selectedWorker) return;

    setAssigning(true);
    try {
      // Update the booking with the assigned worker
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          worker_id: selectedWorker,
          status: 'confirmed'
        })
        .eq('id', selectedBooking);

      if (updateError) {
        throw updateError;
      }

      // Create worker booking entry
      const { error: workerBookingError } = await supabase
        .from('worker_bookings')
        .insert({
          booking_id: selectedBooking,
          worker_id: selectedWorker,
          status: 'assigned'
        });

      if (workerBookingError) {
        console.error('Worker booking error:', workerBookingError);
        // Don't throw here as the main assignment was successful
      }

      toast({
        title: "Success",
        description: "Worker assigned successfully",
      });

      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
      
      onClose();
    } catch (error) {
      console.error('Error assigning worker:', error);
      toast({
        title: "Error",
        description: "Failed to assign worker",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

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
            <Label className="text-base font-medium mb-3 block">
              Unassigned Bookings ({unassignedBookings.length})
            </Label>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {unassignedBookings.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No unassigned bookings</p>
              ) : (
                unassignedBookings.map((booking) => (
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
                          <p className="font-medium">{booking.customer?.name || 'Unknown Customer'}</p>
                          <p className="text-sm text-gray-600">{booking.service?.name || 'Unknown Service'}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(booking.scheduled_date)} at {formatTime(booking.scheduled_start)}</span>
                            </div>
                            {booking.customer?.city && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="h-3 w-3" />
                                <span>{booking.customer.city}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          {booking.id.slice(0, 8)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div>
            <Label className="text-base font-medium mb-3 block">
              Available Workers ({availableWorkers.length})
            </Label>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {availableWorkers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No available workers</p>
              ) : (
                availableWorkers.map((worker) => (
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
                          <p className="text-sm text-gray-600 mt-1">{worker.email}</p>
                          {worker.city && (
                            <div className="flex items-center space-x-1 mt-2">
                              <MapPin className="h-3 w-3 text-gray-500" />
                              <span className="text-sm text-gray-600">{worker.city}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Available
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex space-x-4 mt-6 pt-4 border-t">
          <Button 
            onClick={handleAssign} 
            disabled={!selectedBooking || !selectedWorker || assigning}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {assigning ? 'Assigning...' : 'Assign Worker'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
