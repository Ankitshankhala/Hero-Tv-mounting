
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
      case 'pending': return 'bg-yellow-500';
      case 'confirmed': return 'bg-blue-500';
      case 'authorized': return 'bg-purple-500';
      case 'in_progress': return 'bg-orange-500';
      case 'completed': return 'bg-green-500';
      case 'captured': return 'bg-green-600';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'pending': return 'bg-yellow-500';
      case 'authorized': return 'bg-purple-500';
      case 'captured': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'expired': return 'bg-gray-500';
      default: return 'bg-gray-500';
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
    <Card className="bg-slate-700 border-slate-600">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg text-white">{job.service?.name || 'Service'}</CardTitle>
          <div className="flex flex-col space-y-2">
            <Badge className={`${getStatusColor(job.status)} text-white`}>
              {job.status}
            </Badge>
            {job.payment_status && (
              <Badge className={`${getPaymentStatusColor(job.payment_status)} text-white`}>
                Payment: {job.payment_status}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2 text-slate-300">
          <Clock className="h-4 w-4 text-gray-400" />
          <span>{job.scheduled_date} at {job.scheduled_start}</span>
        </div>

        {job.customer && (
          <div className="space-y-2">
            {job.customer.name && (
              <div className="flex items-center space-x-2 text-slate-300">
                <User className="h-4 w-4 text-gray-400" />
                <span>{job.customer.name}</span>
              </div>
            )}
            {job.customer.phone && (
              <div className="flex items-center space-x-2 text-slate-300">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{job.customer.phone}</span>
              </div>
            )}
            {job.customer.email && (
              <div className="flex items-center space-x-2 text-slate-300">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{job.customer.email}</span>
              </div>
            )}
          </div>
        )}

        {(job.location_notes || job.customer_address) && (
          <div className="flex items-start space-x-2 text-slate-300">
            <MapPin className="h-4 w-4 text-gray-400 mt-1" />
            <span className="text-sm">{job.location_notes || job.customer_address}</span>
          </div>
        )}

        {job.service?.base_price && (
          <div className="flex items-center space-x-2 text-slate-300">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span>${job.service.base_price}</span>
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
