import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, AlertTriangle } from 'lucide-react';

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
  covers_zip?: boolean;
}

export const ReassignJobModal = ({ isOpen, onClose, bookingId, onSuccess }: ReassignJobModalProps) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingWorkers, setFetchingWorkers] = useState(false);
  const [paymentWarning, setPaymentWarning] = useState(false);
  const [customerZip, setCustomerZip] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchEligibleWorkers();
      checkPaymentExpiry();
    }
  }, [isOpen, bookingId]);

  const checkPaymentExpiry = async () => {
    try {
      const { data: booking } = await supabase
        .from('bookings')
        .select('created_at, payment_status')
        .eq('id', bookingId)
        .single();

      if (booking && booking.payment_status === 'authorized') {
        const daysSince = (Date.now() - new Date(booking.created_at!).getTime()) / (1000 * 60 * 60 * 24);
        setPaymentWarning(daysSince > 7);
      } else {
        setPaymentWarning(false);
      }
    } catch {
      setPaymentWarning(false);
    }
  };

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
        setCustomerZip(data.customerZip || '');
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

    const chosen = workers.find(w => w.id === selectedWorkerId);
    if (chosen && chosen.covers_zip === false) {
      const ok = window.confirm(
        `Assign outside service area?\n\nThis worker doesn't normally cover ZIP ${customerZip || 'this area'}. They may have to travel further. Assign anyway?`
      );
      if (!ok) return;
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
        if (data.paymentExpired) {
          toast({
            title: "Job Reassigned — Payment Warning",
            description: `Job reassigned to ${data.newWorkerName}, but payment authorization has expired. Manual payment collection will be required.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Job Reassigned",
            description: `Job has been reassigned to ${data.newWorkerName}. Customer has been notified of the reassignment.`,
          });
        }
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
    setPaymentWarning(false);
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
          <DialogDescription>
            Select a new worker to reassign this job to.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {paymentWarning && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Payment authorization has expired (over 7 days). The new worker will need to collect payment manually.</span>
            </div>
          )}

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
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    No eligible workers found
                  </div>
                ) : (
                  workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      <span className="flex items-center gap-2">
                        <span>{worker.name} ({worker.email})</span>
                        {worker.covers_zip === false ? (
                          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            Outside area
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                            In area
                          </span>
                        )}
                      </span>
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
