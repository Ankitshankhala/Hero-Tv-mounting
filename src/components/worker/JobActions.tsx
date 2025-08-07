import React from 'react';
import { Edit, Phone, MapPin, CreditCard, DollarSign, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentCaptureButton } from './PaymentCaptureButton';
import { initiatePhoneCall } from '@/utils/phoneUtils';
interface JobActionsProps {
  job: any;
  onStatusUpdate: (jobId: string, newStatus: string) => void;
  onModifyClick: () => void;
  onChargeClick: () => void;
  onCaptureSuccess?: () => void;
  onAddServicesClick?: () => void;
}
const JobActions = ({
  job,
  onStatusUpdate,
  onModifyClick,
  onChargeClick,
  onCaptureSuccess,
  onAddServicesClick
}: JobActionsProps) => {
  const callCustomer = (phone: string) => {
    initiatePhoneCall(phone);
  };
  const getCustomerAddress = () => {
    return job.guest_customer_info?.address || job.customer?.address || '';
  };

  const getDirections = () => {
    const address = getCustomerAddress();
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
    }
  };
  const canAddCharges = (job.status === 'in_progress' || job.status === 'confirmed') && job.payment_status !== 'authorized';
  const canCapturePayment = job.payment_status === 'authorized' && job.status !== 'completed';
  const canAddServices = job.status === 'confirmed' || job.status === 'in_progress';
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
  return <div className="pt-6 border-t border-worker-border mt-6">
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <Button size="sm" variant="outline" onClick={() => callCustomer(job.customer?.phone)} disabled={!job.customer?.phone} className="border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-200">
          <Phone className="h-4 w-4 mr-2" />
          Call Customer
        </Button>
        
        <Button size="sm" variant="outline" onClick={getDirections} disabled={!getCustomerAddress()} className="border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-200">
          <MapPin className="h-4 w-4 mr-2" />
          Get Directions
        </Button>
        
        {canAddCharges && <Button size="sm" variant="outline" onClick={onChargeClick} className="border-action-success text-action-success hover:bg-action-success hover:text-white transition-all duration-200">
            <CreditCard className="h-4 w-4 mr-2" />
            Add Charge
          </Button>}
        
        {canCapturePayment && <PaymentCaptureButton bookingId={job.id} paymentStatus={job.payment_status} bookingStatus={job.status} onCaptureSuccess={onCaptureSuccess} />}
        
        {canAddServices && <Button size="sm" variant="outline" onClick={onAddServicesClick} className="border-action-warning text-action-warning hover:bg-action-warning hover:text-white transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            Add Services
          </Button>}
      </div>
      
      {/* Status Update Section */}
      <div className="mt-4 pt-4 border-t border-worker-border/50">
        
      </div>
    </div>;
};
export default JobActions;