
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onCancellationSuccess: () => void;
}

const CancellationModal = ({ isOpen, onClose, job, onCancellationSuccess }: CancellationModalProps) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for cancellation",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the handle_worker_cancellation function
      const { data, error } = await supabase
        .rpc('handle_worker_cancellation', {
          p_booking_id: job.id,
          p_cancellation_reason: reason
        });

      if (error) throw error;

      if (data && data.length > 0 && data[0].success) {
        toast({
          title: "Job Cancelled",
          description: "The job has been cancelled and will be reassigned automatically",
        });
        onCancellationSuccess();
        onClose();
        setReason('');
      } else {
        throw new Error('Failed to cancel job');
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast({
        title: "Error",
        description: "Failed to cancel job. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setReason('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span>Cancel Job</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <p className="text-red-200 text-sm">
              <strong>Warning:</strong> Cancelling this job will remove you as the assigned worker and make it available for reassignment to other workers.
            </p>
          </div>

          <div className="bg-slate-700 rounded-lg p-4">
            <h4 className="font-semibold text-white mb-2">Job Details</h4>
            <div className="text-slate-300 text-sm space-y-1">
              <p><strong>Customer:</strong> {job?.customer?.name || 'N/A'}</p>
              <p><strong>Date:</strong> {job?.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : 'N/A'}</p>
              <p><strong>Time:</strong> {job?.scheduled_at ? new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
              <p><strong>Address:</strong> {job?.customer_address || 'N/A'}</p>
              <p><strong>Price:</strong> ${job?.total_price || 0}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-white">Reason for Cancellation *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you need to cancel this job..."
              className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Keep Job
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? 'Cancelling...' : 'Cancel Job'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancellationModal;
