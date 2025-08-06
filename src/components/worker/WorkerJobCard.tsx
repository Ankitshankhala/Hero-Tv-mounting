
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    special_instructions?: string | null;
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
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showAddServicesModal, setShowAddServicesModal] = useState(false);

  const handleModifyClick = () => setShowModifyModal(true);
  const handleChargeClick = () => setShowChargeModal(true);
  const handleAddServicesClick = () => setShowAddServicesModal(true);

  const handleModificationCreated = () => {
    setShowModifyModal(false);
    onJobCancelled?.();
  };

  const handleChargeSuccess = () => {
    setShowChargeModal(false);
    onJobCancelled?.();
  };

  const handleCaptureSuccess = () => {
    onJobCancelled?.();
  };

  const handleServicesAdded = () => {
    setShowAddServicesModal(false);
    onJobCancelled?.();
  };

  // Format date and time for display
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <Card className="bg-white border border-gray-200 rounded-lg">
      <CardContent className="p-6">
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">New Job Assignment</h3>
          <Badge 
            variant="secondary" 
            className="bg-blue-100 text-blue-800 font-normal"
          >
            {job.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Job Information */}
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-gray-900">Service: </span>
            <span className="text-gray-700">{job.service?.name || 'Service'}</span>
          </div>

          <div>
            <span className="font-medium text-gray-900">Date & Time: </span>
            <span className="text-gray-700">
              {formatDate(job.scheduled_date)} at {formatTime(job.scheduled_start)}
            </span>
          </div>

          {job.customer?.name && (
            <div>
              <span className="font-medium text-gray-900">Customer: </span>
              <span className="text-gray-700">{job.customer.name}</span>
            </div>
          )}

          {job.location_notes && (
            <div>
              <span className="font-medium text-gray-900">Location: </span>
              <span className="text-gray-700">{job.location_notes}</span>
            </div>
          )}

          {job.customer?.phone && (
            <div>
              <span className="font-medium text-gray-900">Phone: </span>
              <span className="text-gray-700">{job.customer.phone}</span>
            </div>
          )}

          {job.customer?.email && (
            <div>
              <span className="font-medium text-gray-900">Email: </span>
              <span className="text-gray-700">{job.customer.email}</span>
            </div>
          )}

          {job.service?.base_price && (
            <div>
              <span className="font-medium text-gray-900">Base Price: </span>
              <span className="text-gray-700">${job.service.base_price}</span>
            </div>
          )}
        </div>

        {/* Special Instructions */}
        {job.special_instructions && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <span className="font-medium text-yellow-800 text-sm">Special Instructions:</span>
            </div>
            <p className="text-yellow-700 text-sm mt-1">{job.special_instructions}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <JobActions
            job={job}
            onStatusUpdate={onStatusUpdate || (() => {})}
            onModifyClick={handleModifyClick}
            onChargeClick={handleChargeClick}
            onCaptureSuccess={handleCaptureSuccess}
            onAddServicesClick={handleAddServicesClick}
          />
        </div>
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
