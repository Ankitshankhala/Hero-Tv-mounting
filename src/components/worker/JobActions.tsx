import React, { useState } from 'react';
import {
  Trash2,
  CreditCard,
  Plus,
  Users,
  Clock,
  Archive,
  CheckCircle,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReassignJobModal } from './ReassignJobModal';
import { RescheduleJobModal } from './RescheduleJobModal';
import { archiveBooking } from '@/utils/serviceHelpers';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface JobActionsProps {
  job: any;
  onStatusUpdate: (jobId: string, newStatus: string) => void;
  onModifyClick: () => void;
  onChargeClick: () => void;
  onCaptureSuccess?: () => void;
  onAddServicesClick?: () => void;
  onModifyServicesClick?: () => void;
  onJobUpdated?: () => void;
}

const JobActions = ({
  job,
  onStatusUpdate,
  onModifyClick,
  onChargeClick,
  onCaptureSuccess,
  onAddServicesClick,
  onModifyServicesClick,
  onJobUpdated,
}: JobActionsProps) => {
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { toast } = useToast();


  // Single source of truth for the unified worker action.
  // Backend (payment-engine) is the final authority — these guards just
  // prevent obviously bad clicks.
  const canCompleteAndCapture =
    ['confirmed', 'in_progress', 'payment_authorized'].includes(job.status) &&
    job.payment_status === 'authorized' &&
    !!job.payment_intent_id &&
    !job.requires_manual_payment &&
    !job.pending_payment_amount; // H6: do not allow capture while a re-auth is pending

  const canCollectPayment =
    job.payment_status === 'failed' ||
    job.payment_status === 'cancelled' ||
    job.requires_manual_payment === true ||
    Number(job.pending_payment_amount || 0) > 0;
  const canAddServices =
    job.status === 'confirmed' ||
    job.status === 'in_progress' ||
    job.status === 'payment_authorized';
  const canModifyServices = canAddServices;
  const canReassignOrReschedule =
    job.status !== 'completed' && job.status !== 'cancelled';
  const canArchive =
    job.status === 'completed' &&
    (job.payment_status === 'captured' || job.payment_status === 'completed');

  // ONE button → ONE backend call. Edge function captures Stripe and marks
  // booking completed + archived atomically. Frontend never mutates booking
  // status directly.
  const handleCompleteAndCapture = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      // C1 fix: payment-engine.complete-and-capture runs validateAuth(); we MUST
      // forward the user's Bearer token because verify_jwt is false on this function
      // (the SDK does not auto-attach the user JWT in that case).
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke(
        'worker-complete-and-capture',
        {
          body: { booking_id: job.id },
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        }
      );

      if (error) {
        const err: any = error as any;
        const msg =
          err?.context?.error ||
          err?.message ||
          'Unable to complete job and capture payment';
        throw new Error(msg);
      }
      if (!data?.success) {
        throw new Error(
          data?.error || 'Unable to complete job and capture payment'
        );
      }

      const captured = Number(data.amount_captured || 0);
      toast({
        title: data.recovered_from_stripe
          ? 'Job Completed (Recovered)'
          : 'Job Completed & Payment Captured',
        description: `Successfully charged $${captured.toFixed(2)}`,
      });
      onCaptureSuccess?.();
      onJobUpdated?.();
    } catch (err) {
      console.error('[JobActions] complete-and-capture failed:', err);
      toast({
        title: 'Payment Not Captured',
        description:
          err instanceof Error
            ? err.message
            : 'The job was not completed. Please try again or contact admin.',
        variant: 'destructive',
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleArchiveJob = async () => {
    try {
      await archiveBooking(job.id);
      toast({
        title: 'Job Archived',
        description: 'The completed job has been archived successfully.',
      });
      onJobUpdated?.();
    } catch (error) {
      console.error('Error archiving job:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive the job. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const hasOverflow =
    canModifyServices || canReassignOrReschedule || canArchive;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {canCompleteAndCapture && (
          <Button
            onClick={handleCompleteAndCapture}
            disabled={completing}
            className="h-11 md:h-10 px-4 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {completing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {completing ? 'Processing…' : 'Complete & collect payment'}
          </Button>
        )}

        {canCollectPayment && (
          <Button
            onClick={onChargeClick}
            className="h-11 md:h-10 px-4 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {Number(job.pending_payment_amount || 0) > 0
              ? `Collect payment ($${Number(job.pending_payment_amount).toFixed(2)})`
              : 'Collect payment'}
          </Button>
        )}

        {canAddServices && (
          <Button
            variant="outline"
            onClick={onAddServicesClick}
            className="h-11 md:h-10 px-4 text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add services
          </Button>
        )}

        {hasOverflow && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 md:h-10 md:w-10"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canModifyServices && (
                <DropdownMenuItem onClick={onModifyServicesClick}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove services
                </DropdownMenuItem>
              )}
              {canReassignOrReschedule && (
                <>
                  <DropdownMenuItem onClick={() => setShowReassignModal(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Reassign job
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowRescheduleModal(true)}>
                    <Clock className="h-4 w-4 mr-2" />
                    Change time
                  </DropdownMenuItem>
                </>
              )}
              {canArchive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleArchiveJob}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive job
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {(job.payment_status === 'failed' ||
        job.payment_status === 'cancelled') && (
        <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium">
            Payment required before job completion
          </p>
        </div>
      )}


      <ReassignJobModal
        isOpen={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        bookingId={job.id}
        onSuccess={() => {
          onJobUpdated?.();
          setShowReassignModal(false);
        }}
      />

      <RescheduleJobModal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        bookingId={job.id}
        currentDate={job.scheduled_date}
        currentTime={job.scheduled_start}
        onSuccess={() => {
          onJobUpdated?.();
          setShowRescheduleModal(false);
        }}
      />
    </div>
  );
};

export default JobActions;
