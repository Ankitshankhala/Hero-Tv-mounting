import React, { useState } from 'react';
import { Calendar, MapPin, Clock, Phone, Edit, AlertCircle, X, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InvoiceModificationModal from './InvoiceModificationModal';
import CancellationModal from './CancellationModal';
import OnSiteChargeModal from './OnSiteChargeModal';

interface WorkerJobCardProps {
  job: any;
  onStatusUpdate: (jobId: string, newStatus: string) => void;
  onJobCancelled?: () => void;
}

const WorkerJobCard = ({ job, onStatusUpdate, onJobCancelled }: WorkerJobCardProps) => {
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in_progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}hr ${mins > 0 ? `${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  const getServicesDisplay = (services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => `${s.name} (${s.quantity})`).join(', ');
    }
    return 'Service details';
  };

  const callCustomer = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const getDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
  };

  const handleModificationCreated = () => {
    // Refresh the job data or trigger a re-fetch
    window.location.reload();
  };

  const handleCancellationSuccess = () => {
    if (onJobCancelled) {
      onJobCancelled();
    }
  };

  const handleChargeSuccess = () => {
    // Refresh the job data
    window.location.reload();
  };

  const canCancelJob = job.status === 'confirmed' || job.status === 'pending';

  const canAddCharges = job.status === 'in_progress' || job.status === 'confirmed';

  return (
    <>
      <Card className="bg-slate-700 border-slate-600">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {job.customer?.name || 'Customer'}
              </h3>
              <p className="text-slate-400">Job #{job.id.slice(0, 8)} • {getServicesDisplay(job.services)}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2">
                {getStatusBadge(job.status)}
                {job.has_modifications && (
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                    Modified
                  </Badge>
                )}
              </div>
              <p className="text-xl font-bold text-white mt-1">${job.total_price}</p>
              {job.pending_payment_amount && job.pending_payment_amount !== 0 && (
                <p className={`text-sm ${job.pending_payment_amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Pending: {job.pending_payment_amount > 0 ? '+' : ''}${job.pending_payment_amount}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center space-x-2 text-slate-300">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(job.scheduled_at)} at {formatTime(job.scheduled_at)}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(job.total_duration_minutes)}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <Phone className="h-4 w-4" />
              <span>{job.customer?.phone || 'No phone'}</span>
            </div>
          </div>

          <div className="flex items-start space-x-2 mb-4 text-slate-300">
            <MapPin className="h-4 w-4 mt-0.5" />
            <span>{job.customer_address}</span>
          </div>

          {job.special_instructions && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 mb-4">
              <p className="text-yellow-200 text-sm">
                <strong>Special Instructions:</strong> {job.special_instructions}
              </p>
            </div>
          )}

          {job.has_modifications && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-blue-400" />
                <p className="text-blue-200 text-sm">
                  <strong>Invoice has been modified.</strong> Customer approval may be required for payment changes.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-600">
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => callCustomer(job.customer?.phone)}
                disabled={!job.customer?.phone}
              >
                Call Customer
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => getDirections(job.customer_address)}
              >
                Get Directions
              </Button>
              {canAddCharges && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowChargeModal(true)}
                  className="text-green-400 border-green-400 hover:bg-green-400 hover:text-white"
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  Add Charge
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowModifyModal(true)}
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
                  onClick={() => setShowCancelModal(true)}
                  className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel Job
                </Button>
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
        </CardContent>
      </Card>

      <InvoiceModificationModal
        isOpen={showModifyModal}
        onClose={() => setShowModifyModal(false)}
        job={job}
        onModificationCreated={handleModificationCreated}
      />

      <CancellationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        job={job}
        onCancellationSuccess={handleCancellationSuccess}
      />

      <OnSiteChargeModal
        isOpen={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        job={job}
        onChargeSuccess={handleChargeSuccess}
      />
    </>
  );
};

export default WorkerJobCard;
