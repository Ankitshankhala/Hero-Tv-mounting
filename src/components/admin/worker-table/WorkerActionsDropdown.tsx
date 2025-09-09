
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Edit, MoreVertical, UserX, UserCheck, Trash2, MessageSquare, KeyRound, MapPin } from 'lucide-react';
import { useSmsNotifications } from '@/hooks/useSmsNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

interface WorkerActionsDropdownProps {
  worker: Worker;
  onEditWorker: (worker: Worker) => void;
  onManagePassword: (worker: Worker) => void;
  onManageCoverage?: (worker: Worker) => void;
  onRemoveWorker: (workerId: string) => void;
  onReactivateWorker: (workerId: string) => void;
  onPermanentlyDeleteWorker: (workerId: string) => void;
  removingWorkerId: string | null;
  reactivatingWorkerId: string | null;
  deletingWorkerId: string | null;
}

export const WorkerActionsDropdown = ({ 
  worker, 
  onEditWorker, 
  onManagePassword,
  onManageCoverage,
  onRemoveWorker, 
  onReactivateWorker,
  onPermanentlyDeleteWorker,
  removingWorkerId,
  reactivatingWorkerId,
  deletingWorkerId
}: WorkerActionsDropdownProps) => {
  const [sendingSms, setSendingSms] = useState(false);
  const { resendWorkerSms } = useSmsNotifications();
  const { toast } = useToast();

  const handleSendTestSms = async () => {
    if (!worker.phone) {
      toast({
        title: "No Phone Number",
        description: "Worker doesn't have a phone number registered",
        variant: "destructive",
      });
      return;
    }

    setSendingSms(true);
    try {
      // Find the most recent booking for this worker
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id')
        .eq('worker_id', worker.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!bookings || bookings.length === 0) {
        toast({
          title: "No Bookings Found",
          description: "Worker needs at least one booking to send a test SMS",
          variant: "destructive",
        });
        return;
      }

      const success = await resendWorkerSms(bookings[0].id);
      if (success) {
        toast({
          title: "Test SMS Sent",
          description: `Test SMS sent to ${worker.name} (${worker.phone})`,
        });
      }
    } catch (error) {
      console.error('Error sending test SMS:', error);
      toast({
        title: "SMS Error",
        description: "Failed to send test SMS",
        variant: "destructive",
      });
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEditWorker(worker)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Details
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => onManagePassword(worker)}>
          <KeyRound className="h-4 w-4 mr-2" />
          Manage Password
        </DropdownMenuItem>

        {onManageCoverage && (
          <DropdownMenuItem onClick={() => onManageCoverage(worker)}>
            <MapPin className="h-4 w-4 mr-2" />
            Manage Coverage
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem
          onClick={handleSendTestSms}
          disabled={sendingSms || !worker.phone}
          className="text-blue-600 hover:text-blue-700 focus:text-blue-700"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          {sendingSms ? 'Sending...' : 'Send Test SMS'}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {worker.is_active ? (
          <DropdownMenuItem 
            onClick={() => onRemoveWorker(worker.id)}
            disabled={removingWorkerId === worker.id}
            className="text-red-600 hover:text-red-700 focus:text-red-700"
          >
            <UserX className="h-4 w-4 mr-2" />
            {removingWorkerId === worker.id ? 'Removing...' : 'Remove Worker'}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onReactivateWorker(worker.id)}
              disabled={reactivatingWorkerId === worker.id}
              className="text-green-600 hover:text-green-700 focus:text-green-700"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {reactivatingWorkerId === worker.id ? 'Reactivating...' : 'Reactivate Worker'}
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => onPermanentlyDeleteWorker(worker.id)}
              disabled={deletingWorkerId === worker.id}
              className="text-red-600 hover:text-red-700 focus:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deletingWorkerId === worker.id ? 'Deleting...' : 'Permanently Delete'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
