
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city: string;
  region: string;
  is_active: boolean;
  created_at: string;
  worker_availability?: any[];
}

interface WorkerDetailsModalProps {
  worker: Worker | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkerDetailsModal = ({ worker, isOpen, onClose }: WorkerDetailsModalProps) => {
  if (!worker) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-background">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Worker: {worker.name}</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Name</label>
                <div className="p-2 bg-muted rounded border text-sm text-foreground">
                  {worker.name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Email</label>
                <div className="p-2 bg-muted rounded border text-sm text-foreground">
                  {worker.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Phone</label>
                <div className="p-2 bg-muted rounded border text-sm text-foreground">
                  {worker.phone || 'Not provided'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Location</label>
                <div className="p-2 bg-muted rounded border text-sm text-foreground">
                  {worker.city}, {worker.region}
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-4">
              <p><strong>Note:</strong> Worker profile editing is currently view-only. Contact system administrator for changes.</p>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
