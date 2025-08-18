
import React, { useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { WorkerTableRow } from './worker-table/WorkerTableRow';
import { WorkerDetailsModal } from './worker-table/WorkerDetailsModal';
import { WorkerCalendarModal } from './worker-table/WorkerCalendarModal';
import { WorkerPasswordManager } from './WorkerPasswordManager';

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

  const handleRemoveWorker = async (workerId: string) => {
    try {
      setRemovingWorkerId(workerId);
      
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', workerId);

      if (error) {
        console.error('Error removing worker:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Worker has been removed successfully",
      });

      if (onWorkerUpdate) {
        onWorkerUpdate();
      }
    } catch (error) {
      console.error('Error removing worker:', error);
      toast({
        title: "Error",
        description: "Failed to remove worker",
        variant: "destructive",
      });
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

      if (error) {
        console.error('Error reactivating worker:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Worker has been reactivated successfully",
      });

      if (onWorkerUpdate) {
        onWorkerUpdate();
      }
    } catch (error) {
      console.error('Error reactivating worker:', error);
      toast({
        title: "Error",
        description: "Failed to reactivate worker",
        variant: "destructive",
      });
    } finally {
      setReactivatingWorkerId(null);
    }
  };

  const handlePermanentlyDeleteWorker = async (workerId: string) => {
    if (!confirm("Are you sure you want to permanently delete this worker? This action cannot be undone and will remove all associated data.")) {
      return;
    }

    try {
      setDeletingWorkerId(workerId);
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', workerId);

      if (error) {
        console.error('Error permanently deleting worker:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Worker has been permanently deleted",
      });

      if (onWorkerUpdate) {
        onWorkerUpdate();
      }
    } catch (error) {
      console.error('Error permanently deleting worker:', error);
      toast({
        title: "Error",
        description: "Failed to permanently delete worker",
        variant: "destructive",
      });
    } finally {
      setDeletingWorkerId(null);
    }
  };

  const closeModals = () => {
    setShowCalendar(false);
    setShowEditModal(false);
    setShowPasswordManager(false);
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
                onRemoveWorker={handleRemoveWorker}
                onReactivateWorker={handleReactivateWorker}
                onPermanentlyDeleteWorker={handlePermanentlyDeleteWorker}
                removingWorkerId={removingWorkerId}
                reactivatingWorkerId={reactivatingWorkerId}
                deletingWorkerId={deletingWorkerId}
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
    </>
  );
};
