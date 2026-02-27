import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';

interface ReassignJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  onSuccess: () => void;
}

interface Worker {
  id: string;
  name: string;
  email: string;
}

export const ReassignJobModal = ({ isOpen, onClose, bookingId, onSuccess }: ReassignJobModalProps) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingWorkers, setFetchingWorkers] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchEligibleWorkers();
    }
  }, [isOpen, bookingId]);

  const fetchEligibleWorkers = async () => {
    setFetchingWorkers(true);
    try {
      console.log('Fetching eligible workers for booking:', bookingId);
      
      const response = await fetch(`https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/worker-operations/eligible-workers?bookingId=${bookingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      const data = await response.json();
      console.log('Eligible workers response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch workers');
      }

      if (data?.success) {
        setWorkers(data.workers);
      } else {
        throw new Error(data?.error || 'Failed to fetch workers');
      }
    } catch (error) {
      console.error('Error fetching eligible workers:', error);
      toast({
        title: "Error Loading Workers",
        description: error instanceof Error ? error.message : "Failed to fetch available workers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setFetchingWorkers(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedWorkerId) {
      toast({
        title: "Error",
        description: "Please select a worker to reassign the job to",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('worker-reassign-booking', {
        body: {
          bookingId,
          newWorkerId: selectedWorkerId,
          reason: reason.trim() || undefined
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "Job Reassigned",
          description: `Job has been reassigned to ${data.newWorkerName}. Customer has been notified of the reassignment.`,
        });
        onSuccess();
        onClose();
      } else {
        throw new Error(data?.error || 'Reassignment failed');
      }
    } catch (error) {
      console.error('Error reassigning job:', error);
      toast({
        title: "Reassignment Failed",
        description: error instanceof Error ? error.message : "Failed to reassign job",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedWorkerId('');
    setReason('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Reassign Job
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="worker-select">Select Worker</Label>
            <Select
              value={selectedWorkerId}
              onValueChange={setSelectedWorkerId}
              disabled={fetchingWorkers}
            >
              <SelectTrigger id="worker-select">
                <SelectValue placeholder={fetchingWorkers ? "Loading workers..." : "Choose a worker"} />
              </SelectTrigger>
              <SelectContent>
                {workers.length === 0 && !fetchingWorkers ? (
                  <SelectItem value="" disabled>
                    No eligible workers found
                  </SelectItem>
                ) : (
                  workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.name} ({worker.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="reason">Reason for Reassignment (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're reassigning this job..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={loading || !selectedWorkerId}>
            {loading ? 'Reassigning...' : 'Reassign Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};