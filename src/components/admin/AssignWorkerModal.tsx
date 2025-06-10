
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
}

interface AssignWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onAssign: (bookingId: string, workerId: string) => void;
}

export const AssignWorkerModal: React.FC<AssignWorkerModalProps> = ({
  isOpen,
  onClose,
  booking,
  onAssign
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingWorkers, setFetchingWorkers] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && booking) {
      fetchAvailableWorkers();
    }
  }, [isOpen, booking]);

  const fetchAvailableWorkers = async () => {
    if (!booking) return;
    
    setFetchingWorkers(true);
    try {
      // Fetch all workers with worker role
      const { data: workersData, error } = await supabase
        .from('users')
        .select('id, name, email, phone, region')
        .eq('role', 'worker')
        .eq('is_active', true);

      if (error) throw error;

      setWorkers(workersData || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch available workers",
        variant: "destructive",
      });
    } finally {
      setFetchingWorkers(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedWorkerId || !booking) {
      toast({
        title: "Error",
        description: "Please select a worker",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          worker_id: selectedWorkerId,
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw error;

      onAssign(booking.id, selectedWorkerId);
      
      toast({
        title: "Success",
        description: "Worker assigned successfully",
      });
      
      onClose();
    } catch (error) {
      console.error('Error assigning worker:', error);
      toast({
        title: "Error",
        description: "Failed to assign worker",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
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
        
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Booking Details</h4>
            <p className="text-sm text-gray-600">
              <strong>Date:</strong> {new Date(booking.scheduled_at).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Time:</strong> {new Date(booking.scheduled_at).toLocaleTimeString()}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Address:</strong> {booking.customer_address}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Total:</strong> ${booking.total_price}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker">Select Worker</Label>
            {fetchingWorkers ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a worker" />
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
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={loading || !selectedWorkerId || fetchingWorkers}
            >
              {loading ? 'Assigning...' : 'Assign Worker'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
