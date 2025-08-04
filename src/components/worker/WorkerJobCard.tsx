
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, User, Phone, Mail, DollarSign } from 'lucide-react';

import JobActions from './JobActions';
import { EnhancedInvoiceModificationModal } from './EnhancedInvoiceModificationModal';
import OnSiteChargeModal from './OnSiteChargeModal';

import { AddServicesModal } from './AddServicesModal';

interface WorkerJobCardProps {
  job: {
    id: string;
    scheduled_date: string;
    scheduled_start: string;
    status: string;
    payment_status?: string;
    location_notes?: string;
    customer_address?: string;
    pending_payment_amount?: number;
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    service?: {
      name?: string;
      base_price?: number;
    };
  };
  onStatusUpdate?: (jobId: string, newStatus: string) => void;
  onJobCancelled?: () => void;
}

export const WorkerJobCard = ({ job, onStatusUpdate, onJobCancelled }: WorkerJobCardProps) => {
  console.log('WorkerJobCard rendering with job:', job.id);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showAddServicesModal, setShowAddServicesModal] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-status-pending';
      case 'confirmed': return 'bg-status-confirmed';
      case 'authorized': return 'bg-status-confirmed';
      case 'in_progress': return 'bg-status-progress';
      case 'completed': return 'bg-status-completed';
      case 'captured': return 'bg-status-completed';
      case 'cancelled': return 'bg-status-cancelled';
      default: return 'bg-muted';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'pending': return 'bg-status-pending';
      case 'authorized': return 'bg-status-confirmed';
      case 'captured': return 'bg-status-completed';
      case 'failed': return 'bg-status-cancelled';
      case 'expired': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  const handleModifyClick = () => {
    setShowModifyModal(true);
  };


  const handleChargeClick = () => {
    setShowChargeModal(true);
  };


  const handleModificationCreated = () => {
    setShowModifyModal(false);
    if (onJobCancelled) {
      onJobCancelled(); // Refresh the jobs list
    }
  };

  const handleChargeSuccess = () => {
    setShowChargeModal(false);
    if (onJobCancelled) {
      onJobCancelled(); // Refresh the jobs list
    }
  };

  const handleCaptureSuccess = () => {
    if (onJobCancelled) {
      onJobCancelled(); // Refresh the jobs list
    }
  };

  const handleAddServicesClick = () => {
    setShowAddServicesModal(true);
  };

  const handleServicesAdded = () => {
    setShowAddServicesModal(false);
    if (onJobCancelled) {
      onJobCancelled(); // Refresh the jobs list
    }
  };

  return (
    <Card className="bg-worker-card border-worker-border shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-worker-card-hover group relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-worker-card-foreground group-hover:text-primary transition-colors">
            {job.service?.name || 'Service'}
          </CardTitle>
          <div className="flex flex-col space-y-2">
            <Badge className={`${getStatusColor(job.status)} text-white font-medium px-3 py-1 rounded-full shadow-sm`}>
              {job.status.replace('_', ' ').toUpperCase()}
            </Badge>
            {job.payment_status && (
              <Badge className={`${getPaymentStatusColor(job.payment_status)} text-white font-medium px-3 py-1 rounded-full shadow-sm`}>
                Payment: {job.payment_status.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3 text-worker-card-foreground/90 bg-worker-border/30 rounded-lg p-3">
          <Clock className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <p className="font-medium">{job.scheduled_date}</p>
            <p className="text-sm text-worker-muted">at {job.scheduled_start}</p>
          </div>
        </div>

        {job.customer && (
          <div className="space-y-3 bg-worker-border/20 rounded-lg p-4">
            <h4 className="font-medium text-worker-card-foreground mb-2">Customer Information</h4>
            {job.customer.name && (
              <div className="flex items-center space-x-3 text-worker-card-foreground/90">
                <User className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium">{job.customer.name}</span>
              </div>
            )}
            {job.customer.phone && (
              <div className="flex items-center space-x-3 text-worker-card-foreground/90">
                <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                <span>{job.customer.phone}</span>
              </div>
            )}
            {job.customer.email && (
              <div className="flex items-center space-x-3 text-worker-card-foreground/90">
                <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm">{job.customer.email}</span>
              </div>
            )}
          </div>
        )}

        {(job.location_notes || job.customer_address) && (
          <div className="flex items-start space-x-3 text-worker-card-foreground/90 bg-worker-border/20 rounded-lg p-3">
            <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Location</p>
              <p className="text-sm text-worker-muted">{job.location_notes || job.customer_address}</p>
            </div>
          </div>
        )}

        {job.service?.base_price && (
          <div className="flex items-center space-x-3 text-worker-card-foreground bg-action-success/10 border border-action-success/20 rounded-lg p-3">
            <DollarSign className="h-5 w-5 text-action-success flex-shrink-0" />
            <div>
              <p className="text-sm text-worker-muted">Base Price</p>
              <p className="font-semibold text-lg text-action-success">${job.service.base_price}</p>
            </div>
          </div>
        )}


        <JobActions
          job={job}
          onStatusUpdate={onStatusUpdate || (() => {})}
          onModifyClick={handleModifyClick}
          onChargeClick={handleChargeClick}
          onCaptureSuccess={handleCaptureSuccess}
          onAddServicesClick={handleAddServicesClick}
        />
      </CardContent>

      {/* Modals */}
      {showModifyModal && (
        <EnhancedInvoiceModificationModal
          isOpen={showModifyModal}
          onClose={() => setShowModifyModal(false)}
          job={job}
          onModificationCreated={handleModificationCreated}
        />
      )}

      {showChargeModal && (
        <OnSiteChargeModal
          isOpen={showChargeModal}
          onClose={() => setShowChargeModal(false)}
          job={job}
          onChargeSuccess={handleChargeSuccess}
        />
      )}


      {showAddServicesModal && (
        <AddServicesModal
          isOpen={showAddServicesModal}
          onClose={() => setShowAddServicesModal(false)}
          job={job}
          onServicesAdded={handleServicesAdded}
        />
      )}
    </Card>
  );
};
