import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useImpersonation } from '@/hooks/useImpersonation';

interface ViewAsWorkerButtonProps {
  workerId: string;
  workerName: string;
  workerEmail: string;
}

export const ViewAsWorkerButton = ({ 
  workerId, 
  workerName, 
  workerEmail 
}: ViewAsWorkerButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [reason, setReason] = useState('');
  const { startImpersonation, loading } = useImpersonation();

  const handleConfirm = async () => {
    const success = await startImpersonation(workerId, reason);
    if (success) {
      setShowDialog(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Eye className="h-4 w-4" />
        View as Worker
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View as Worker</DialogTitle>
            <DialogDescription>
              You are about to view the worker dashboard as{' '}
              <strong>{workerName || workerEmail}</strong>. This action is 
              logged for security and audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Helping worker with technical issue, verifying bookings..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Document why you're accessing this worker's dashboard
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Security Notice:</strong> You'll have full access to 
                this worker's dashboard. All actions will be logged with your 
                admin account.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Viewing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
