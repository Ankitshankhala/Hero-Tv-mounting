
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import WorkerCalendar from '@/components/worker/WorkerCalendar';
import WorkerScheduleManager from '@/components/worker/WorkerScheduleManager';

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

interface WorkerCalendarModalProps {
  worker: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onWorkerUpdate?: () => void;
}

export const WorkerCalendarModal = ({ 
  worker, 
  isOpen, 
  onClose, 
  onWorkerUpdate 
}: WorkerCalendarModalProps) => {
  if (!worker) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-foreground text-xl font-semibold">
            {worker.name}'s Calendar & Schedule
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Calendar Section */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg shadow-sm">
                <div className="p-4 border-b border-border">
                  <h3 className="text-lg font-semibold text-card-foreground">Jobs Calendar</h3>
                  <p className="text-sm text-muted-foreground">View scheduled jobs and appointments</p>
                </div>
                <div className="p-4">
                  <WorkerCalendar workerId={worker.id} />
                </div>
              </div>
            </div>
            
            {/* Schedule Manager Section */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg shadow-sm">
                <div className="p-4 border-b border-border">
                  <h3 className="text-lg font-semibold text-card-foreground">Availability Schedule</h3>
                  <p className="text-sm text-muted-foreground">Manage working hours and availability</p>
                </div>
                <div className="p-4">
                  <WorkerScheduleManager workerId={worker.id} onScheduleUpdate={onWorkerUpdate} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
