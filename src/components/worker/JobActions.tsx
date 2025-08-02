import React from 'react';
import { Edit, Phone, MapPin, CreditCard, DollarSign, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentCaptureButton } from './PaymentCaptureButton';
interface JobActionsProps {
  job: any;
  onStatusUpdate: (jobId: string, newStatus: string) => void;
  onModifyClick: () => void;
  onChargeClick: () => void;
  onCollectPaymentClick?: () => void;
  onCaptureSuccess?: () => void;
  onAddServicesClick?: () => void;
}
const JobActions = ({
  job,
  onStatusUpdate,
  onModifyClick,
  onChargeClick,
  onCollectPaymentClick,
  onCaptureSuccess,
  onAddServicesClick
}: JobActionsProps) => {
  const callCustomer = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };
  const getDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
  };
  const canAddCharges = (job.status === 'in_progress' || job.status === 'confirmed') && job.payment_status !== 'authorized';
  const hasUnpaidAmount = job.pending_payment_amount > 0;
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
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'payment_pending': return 'Payment Pending';
      case 'payment_authorized': return 'Payment Authorized';
      default: return status;
    }
  };

  return <div className="flex items-center pt-4 border-t border-slate-600">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => callCustomer(job.customer?.phone)} disabled={!job.customer?.phone}>
          <Phone className="h-4 w-4 mr-1" />
          Call Customer
        </Button>
        <Button size="sm" variant="outline" onClick={() => getDirections(job.customer_address)}>
          <MapPin className="h-4 w-4 mr-1" />
          Get Directions
        </Button>
        {hasUnpaidAmount && <Button size="sm" variant="outline" onClick={onCollectPaymentClick} className="text-orange-400 border-orange-400 hover:bg-orange-400 hover:text-white">
            <DollarSign className="h-4 w-4 mr-1" />
            Collect Payment (${job.pending_payment_amount})
          </Button>}
        {canAddCharges && <Button size="sm" variant="outline" onClick={onChargeClick} className="text-green-400 border-green-400 hover:bg-green-400 hover:text-white">
            <CreditCard className="h-4 w-4 mr-1" />
            Add Charge
          </Button>}
        {canCapturePayment && <PaymentCaptureButton bookingId={job.id} paymentStatus={job.payment_status} bookingStatus={job.status} onCaptureSuccess={onCaptureSuccess} />}
        {canAddServices && <Button size="sm" variant="outline" onClick={onAddServicesClick} className="text-purple-400 border-purple-400 hover:bg-purple-400 hover:text-white">
            <Plus className="h-4 w-4 mr-1" />
            Add Services
          </Button>}
      </div>
    </div>;
};
export default JobActions;