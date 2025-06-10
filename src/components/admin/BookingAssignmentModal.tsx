
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  region?: string;
}

interface Booking {
  id: string;
  scheduled_at: string;
  customer_address: string;
  services: any;
  total_price: number;
  status: string;
  customer?: {
    name: string;
  };
}

interface BookingAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BookingAssignmentModal: React.FC<BookingAssignmentModalProps> = ({
  isOpen,
  onClose
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchRealData();
    }
  }, [isOpen]);

  const fetchRealData = async () => {
    setFetchingData(true);
    try {
      console.log('Fetching workers and bookings from database...');
      
      // Fetch active workers
      const { data: workersData, error: workersError } = await supabase
        .from('users')
        .select('id, name, email, phone, region')
        .eq('role', 'worker')
        .eq('is_active', true);

      if (workersError) {
        console.error('Error fetching workers:', workersError);
        throw workersError;
      }

      console.log('Fetched workers:', workersData);

      // Fetch unassigned pending bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id, 
          scheduled_at, 
          customer_address, 
          services, 
          total_price, 
          status,
          customer:users!customer_id(name)
        `)
        .is('worker_id', null)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      console.log('Fetched unassigned bookings:', bookingsData);

      setWorkers(workersData || []);
      setBookings(bookingsData || []);
    } catch (error) {
      console.error('Error fetching real data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch workers and bookings from database",
        variant: "destructive",
      });
    } finally {
      setFetchingData(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedWorkerId || !selectedBookingId) {
      toast({
        title: "Error",
        description: "Please select both a worker and a booking",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Assigning worker', selectedWorkerId, 'to booking', selectedBookingId);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          worker_id: selectedWorkerId,
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBookingId);

      if (error) {
        console.error('Assignment error:', error);
        throw error;
      }

      console.log('Worker assigned successfully');
      
      toast({
        title: "Success",
        description: "Worker assigned successfully to booking",
      });

      // Reset form and refresh data
      setSelectedWorkerId('');
      setSelectedBookingId('');
      await fetchRealData(); // Refresh the data
      onClose();
    } catch (error) {
      console.error('Error assigning worker:', error);
      toast({
        title: "Error",
        description: "Failed to assign worker to booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Assign Worker to Booking</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="space-y-6">
          {fetchingData ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading data from database...</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="booking">Select Booking</Label>
                <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an unassigned booking" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {booking.customer?.name || 'Unknown Customer'} - ${booking.total_price}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(booking.scheduled_at).toLocaleDateString()} at{' '}
                            {new Date(booking.scheduled_at).toLocaleTimeString()}
                          </span>
                          <span className="text-xs text-gray-400">
                            {booking.customer_address}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bookings.length === 0 && (
                  <p className="text-sm text-gray-500">No unassigned pending bookings found</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="worker">Select Worker</Label>
                <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an active worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{worker.name}</span>
                          <span className="text-sm text-gray-500">{worker.email}</span>
                          {worker.region && (
                            <span className="text-xs text-gray-400">Region: {worker.region}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {workers.length === 0 && (
                  <p className="text-sm text-gray-500">No active workers found</p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAssign} 
                  disabled={loading || !selectedWorkerId || !selectedBookingId || workers.length === 0 || bookings.length === 0}
                >
                  {loading ? 'Assigning...' : 'Assign Worker'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
