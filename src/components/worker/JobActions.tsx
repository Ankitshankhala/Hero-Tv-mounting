
import React from 'react';
import { Edit, Phone, MapPin, CreditCard, X, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentCaptureButton } from './PaymentCaptureButton';

interface JobActionsProps {
  job: any;
  onStatusUpdate: (jobId: string, newStatus: string) => void;
  onModifyClick: () => void;
  onCancelClick: () => void;
  onChargeClick: () => void;
  onCollectPaymentClick?: () => void;
}

const JobActions = ({ 
  job, 
  onStatusUpdate, 
  onModifyClick, 
  onCancelClick, 
  onChargeClick,
  onCollectPaymentClick 
}: JobActionsProps) => {
  const callCustomer = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const getDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
  };

  const canCancelJob = job.status === 'confirmed' || job.status === 'pending';
  const canAddCharges = job.status === 'in_progress' || job.status === 'confirmed';
  const hasUnpaidAmount = job.pending_payment_amount > 0;
  const canCapturePayment = job.payment_status === 'authorized' && job.status === 'confirmed';

  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-600">
      <div className="flex space-x-2">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => callCustomer(job.customer?.phone)}
          disabled={!job.customer?.phone}
        >
          <Phone className="h-4 w-4 mr-1" />
          Call Customer
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => getDirections(job.customer_address)}
        >
          <MapPin className="h-4 w-4 mr-1" />
          Get Directions
        </Button>
        {hasUnpaidAmount && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={onCollectPaymentClick}
            className="text-orange-400 border-orange-400 hover:bg-orange-400 hover:text-white"
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Collect Payment (${job.pending_payment_amount})
          </Button>
        )}
        {canAddCharges && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={onChargeClick}
            className="text-green-400 border-green-400 hover:bg-green-400 hover:text-white"
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Add Charge
          </Button>
        )}
        <Button 
          size="sm" 
          variant="outline"
          onClick={onModifyClick}
          disabled={job.status === 'completed' || job.status === 'cancelled'}
          className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white"
        >
          <Edit className="h-4 w-4 mr-1" />
          Modify Invoice
        </Button>
        {canCancelJob && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={onCancelClick}
            className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel Job
          </Button>
        )}
        {canCapturePayment && (
          <PaymentCaptureButton
            bookingId={job.id}
            paymentStatus={job.payment_status}
            onCaptureSuccess={() => onStatusUpdate(job.id, 'completed')}
          />
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-slate-400 text-sm">Update Status:</span>
        <Select onValueChange={(value) => onStatusUpdate(job.id, value)}>
          <SelectTrigger className="w-40 bg-slate-600 border-slate-500">
            <SelectValue placeholder="Update status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default JobActions;
