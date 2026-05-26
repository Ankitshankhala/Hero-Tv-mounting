
import React, { useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { WorkerTableRow } from './worker-table/WorkerTableRow';
import { WorkerDetailsModal } from './worker-table/WorkerDetailsModal';
import { WorkerCalendarModal } from './worker-table/WorkerCalendarModal';
import { WorkerPasswordManager } from './WorkerPasswordManager';
import { WorkerWeeklyAvailabilityModal } from './WorkerWeeklyAvailabilityModal';
import { AdminWorkerCoverageModal } from './AdminWorkerCoverageModal';
import { ViewAsWorkerButton } from './ViewAsWorkerButton';
import { formatAdminError } from '@/utils/adminErrorMessage';

const showAdminError = (
  toast: ReturnType<typeof useToast>['toast'],
  error: unknown,
  op: string,
  context?: Record<string, unknown>,
) => {
  const info = formatAdminError(error, op);
  console.error(`[ADMIN ERROR] ${op}`, { error, ...context, parsed: info });
  toast({
    title: info.title,
    description: info.description,
    variant: 'destructive',
    duration: 12000,
  });
};

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

interface WorkerTableProps {
  workers: Worker[];
  onWorkerUpdate?: () => void;
}

export const WorkerTable = ({ workers, onWorkerUpdate }: WorkerTableProps) => {
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordManager, setShowPasswordManager] = useState(false);
  const [showWeeklyAvailability, setShowWeeklyAvailability] = useState(false);
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [removingWorkerId, setRemovingWorkerId] = useState<string | null>(null);
  const [reactivatingWorkerId, setReactivatingWorkerId] = useState<string | null>(null);
  const [deletingWorkerId, setDeletingWorkerId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleEditWorker = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowEditModal(true);
  };

  const handleViewCalendar = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowCalendar(true);
  };

  const handleManagePassword = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowPasswordManager(true);
  };

  const handleSetWeeklyAvailability = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowWeeklyAvailability(true);
  };

  const handleManageCoverage = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowCoverageModal(true);
  };

  const handleRemoveWorker = async (workerId: string) => {
    try {
      setRemovingWorkerId(workerId);

      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', workerId);

      if (error) throw error;

      toast({
        title: "Worker removed",
        description: "Toggle 'Show removed' to restore.",
      });

      if (onWorkerUpdate) {
        onWorkerUpdate();
      }
    } catch (error) {
      showAdminError(toast, error, 'remove worker', { workerId });
    } finally {
      setRemovingWorkerId(null);
    }
  };

  const handleReactivateWorker = async (workerId: string) => {
    try {
      setReactivatingWorkerId(workerId);
      
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', workerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Worker has been reactivated successfully",
      });

      if (onWorkerUpdate) {
        onWorkerUpdate();
      }
    } catch (error) {
      showAdminError(toast, error, 'reactivate worker', { workerId });
    } finally {
      setReactivatingWorkerId(null);
    }
  };

  const handlePermanentlyDeleteWorker = async (workerId: string) => {
    if (!workerId) {
      toast({ title: "Error", description: "Invalid worker ID", variant: "destructive" });
      return;
    }

    // Check for related bookings that would block a hard delete
    const { count: bookingsCount, error: bookingsCountError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .or(`worker_id.eq.${workerId},reserved_worker_id.eq.${workerId},preferred_worker_id.eq.${workerId}`);

    if (bookingsCountError) {
      console.error('Error checking worker bookings:', bookingsCountError);
    }

    const hasHistory = (bookingsCount ?? 0) > 0;

    const confirmMsg = hasHistory
      ? `This worker has ${bookingsCount} related booking(s) and cannot be permanently removed without breaking historical records. They will be archived (deactivated) instead. Continue?`
      : "Are you sure you want to permanently delete this worker? This action cannot be undone.";

    if (!confirm(confirmMsg)) return;

    try {
      setDeletingWorkerId(workerId);

      if (hasHistory) {
        // Safe soft-delete to preserve FK integrity (bookings, payroll, invoices)
        const { error } = await supabase
          .from('users')
          .update({ is_active: false })
          .eq('id', workerId);

        if (error) throw error;

        toast({
          title: "Worker Archived",
          description: `Worker has been deactivated. ${bookingsCount} related record(s) preserved.`,
        });
      } else {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', workerId);

        if (error) {
          // Foreign key violation → fall back to soft delete
          if ((error as any).code === '23503') {
            const { error: softErr } = await supabase
              .from('users')
              .update({ is_active: false })
              .eq('id', workerId);
            if (softErr) throw softErr;
            toast({
              title: "Worker Archived",
              description: "Worker is referenced by existing records and was deactivated instead of deleted.",
            });
          } else {
            throw error;
          }
        } else {
          toast({
            title: "Success",
            description: "Worker has been permanently deleted",
          });
        }
      }

      if (onWorkerUpdate) onWorkerUpdate();
    } catch (error: any) {
      console.error('Error deleting worker:', error, { workerId });
      const code = error?.code;
      let description = error?.message || "Failed to delete worker";
      if (code === '23503') {
        description = "Worker is referenced by bookings or other records and cannot be deleted.";
      } else if (code === '42501' || /permission|rls/i.test(description)) {
        description = "You don't have permission to delete this worker.";
      }
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setDeletingWorkerId(null);
    }
  };

  const closeModals = () => {
    setShowCalendar(false);
    setShowEditModal(false);
    setShowPasswordManager(false);
    setShowWeeklyAvailability(false);
    setShowCoverageModal(false);
    setSelectedWorker(null);
  };

  return (
    <>
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Availabilit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.map((worker) => (
              <WorkerTableRow
                key={worker.id}
                worker={worker}
                onViewCalendar={handleViewCalendar}
                onEditWorker={handleEditWorker}
                onManagePassword={handleManagePassword}
                onManageCoverage={handleManageCoverage}
                onSetWeeklyAvailability={handleSetWeeklyAvailability}
                onRemoveWorker={handleRemoveWorker}
                onReactivateWorker={handleReactivateWorker}
                onPermanentlyDeleteWorker={handlePermanentlyDeleteWorker}
                removingWorkerId={removingWorkerId}
                reactivatingWorkerId={reactivatingWorkerId}
                deletingWorkerId={deletingWorkerId}
                renderCustomActions={() => (
                  <ViewAsWorkerButton
                    workerId={worker.id}
                    workerName={worker.name}
                    workerEmail={worker.email}
                  />
                )}
              />
            ))}
          </TableBody>
          </Table>
        </div>
      </div>

      <WorkerCalendarModal
        worker={selectedWorker}
        isOpen={showCalendar}
        onClose={closeModals}
        onWorkerUpdate={onWorkerUpdate}
      />

      <WorkerDetailsModal
        worker={selectedWorker}
        isOpen={showEditModal}
        onClose={closeModals}
      />

      {selectedWorker && (
        <WorkerPasswordManager
          workerId={selectedWorker.id}
          workerEmail={selectedWorker.email}
          workerName={selectedWorker.name || selectedWorker.email}
          isOpen={showPasswordManager}
          onClose={closeModals}
        />
      )}

      <WorkerWeeklyAvailabilityModal
        worker={selectedWorker}
        isOpen={showWeeklyAvailability}
        onClose={closeModals}
        onWorkerUpdate={onWorkerUpdate}
      />

      <AdminWorkerCoverageModal
        worker={selectedWorker}
        isOpen={showCoverageModal}
        onClose={closeModals}
        onSuccess={() => {
          closeModals();
          if (onWorkerUpdate) {
            onWorkerUpdate();
          }
        }}
      />
    </>
  );
};
