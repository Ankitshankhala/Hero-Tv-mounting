import React, { useState } from 'react';
import { Trash2, Phone, MapPin, CreditCard, DollarSign, Plus, Users, Clock, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentCaptureButton } from './PaymentCaptureButton';
import { initiatePhoneCall } from '@/utils/phoneUtils';
import { MapAppSelector } from './MapAppSelector';
import { ReassignJobModal } from './ReassignJobModal';
import { RescheduleJobModal } from './RescheduleJobModal';
import { archiveBooking } from '@/utils/serviceHelpers';
import { useToast } from '@/hooks/use-toast';
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
  onJobUpdated
}: JobActionsProps) => {
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const { toast } = useToast();
  const callCustomer = (phone: string) => {
    initiatePhoneCall(phone);
  };
  const getCustomerAddress = () => {
    return job.guest_customer_info?.address || job.customer?.address || '';
  };

  const getCustomerPhone = () => {
    return job.guest_customer_info?.phone || job.customer?.phone || '';
  };

  const canAddCharges = (job.status === 'in_progress' || job.status === 'confirmed') && 
    job.payment_status !== 'captured' && 
    job.payment_status !== 'completed';
  const canCapturePayment = (
    job.payment_status === 'authorized' || 
    job.status === 'payment_authorized' ||
    job.payment_status === 'capture_failed'
  ) && job.status !== 'completed';
  const canCollectPayment = job.payment_status === 'failed' || job.payment_status === 'cancelled';
  const canAddServices = job.status === 'confirmed' || job.status === 'in_progress' || job.status === 'payment_authorized';
  const canModifyServices = job.status === 'confirmed' || job.status === 'in_progress' || job.status === 'payment_authorized';
  const isPaymentPaid = job.payment_status === 'captured' || job.payment_status === 'completed';
  const canReassignOrReschedule = job.status !== 'completed' && job.status !== 'cancelled';
  const canArchive = job.status === 'completed' && (job.payment_status === 'captured' || job.payment_status === 'completed');

  const handleArchiveJob = async () => {
    try {
      await archiveBooking(job.id);
      toast({
        title: "Job Archived",
        description: "The completed job has been archived successfully.",
      });
      onJobUpdated?.();
    } catch (error) {
      console.error('Error archiving job:', error);
      toast({
        title: "Error",
        description: "Failed to archive the job. Please try again.",
        variant: "destructive",
      });
    }
  };
  const getValidNextStatuses = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
        return ['confirmed'];
      case 'confirmed':
        return ['in_progress'];
      case 'in_progress':
        return ['completed'];
      case 'payment_pending':
        return ['confirmed'];
      case 'payment_authorized':
        return ['confirmed'];
      default:
        return [];
    }
  };
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'payment_pending':
        return 'Payment Pending';
      case 'payment_authorized':
        return 'Payment Authorized';
      default:
        return status;
    }
  };
  return <div className="pt-6 border-t border-worker-border mt-6 job-card">
      <div className="flex flex-wrap gap-2 sm:gap-3 button-group">
        <Button size="sm" variant="outline" onClick={() => callCustomer(getCustomerPhone())} disabled={!getCustomerPhone()} className="job-button border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-200">
          <Phone className="h-4 w-4 mr-2" />
          Call Customer
        </Button>
        
        <MapAppSelector address={getCustomerAddress()} />
        
        
        {canCapturePayment && <PaymentCaptureButton bookingId={job.id} paymentStatus={job.payment_status} bookingStatus={job.status} onCaptureSuccess={onCaptureSuccess} />}
        
        {canCollectPayment && (
          <Button 
            size="sm" 
            variant="default"
            onClick={onChargeClick}
            className="job-button bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Collect Payment
          </Button>
        )}
        
        {/* Prevent completion for jobs with payment issues */}
        {(job.payment_status === 'failed' || job.payment_status === 'cancelled') && (
          <div className="w-full mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive font-medium">
              ⚠️ Payment required before job completion
            </p>
          </div>
        )}
        
        {canAddServices && <Button size="sm" variant="outline" onClick={onAddServicesClick} className="job-button border-action-warning text-action-warning hover:bg-action-warning hover:text-white transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            Add Services
          </Button>}
        
        {canModifyServices && <Button size="sm" variant="outline" onClick={onModifyServicesClick} className="job-button border-action-info text-action-info hover:bg-action-info hover:text-white transition-all duration-200">
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Services
          </Button>}

        {/* Worker Management Actions */}
        {canReassignOrReschedule && (
          <>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowReassignModal(true)}
              className="job-button border-action-warning text-action-warning hover:bg-action-warning hover:text-white transition-all duration-200"
            >
              <Users className="h-4 w-4 mr-2" />
              Reassign Job
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowRescheduleModal(true)}
              className="job-button border-action-info text-action-info hover:bg-action-info hover:text-white transition-all duration-200"
            >
              <Clock className="h-4 w-4 mr-2" />
              Change Time
            </Button>
          </>
        )}

        {/* Archive Action for Completed Jobs */}
        {canArchive && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleArchiveJob}
            className="job-button border-green-500 text-green-600 hover:bg-green-500 hover:text-white transition-all duration-200"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive Job
          </Button>
        )}
      </div>
      
      {/* Status Update Section */}
      <div className="mt-4 pt-4 border-t border-worker-border/50">
        {canReassignOrReschedule && (
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> If you're not able to complete this job at the scheduled time, you can change the time or reassign it to another technician using the buttons above.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
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
    </div>;
};
export default JobActions;