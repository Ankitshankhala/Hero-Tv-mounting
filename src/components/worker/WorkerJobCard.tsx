
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import JobActions from './JobActions';
import { EnhancedInvoiceModificationModal } from './EnhancedInvoiceModificationModal';
import OnSiteChargeModal from './OnSiteChargeModal';
import { AddServicesModal } from './AddServicesModal';

interface BookingService {
  id: string;
  service_name: string;
  quantity: number;
  base_price: number;
  configuration?: {
    wallType?: string;
    tvSize?: string;
    mountType?: string;
    cableManagement?: boolean;
    [key: string]: any;
  };
}

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
    guest_customer_info?: {
      name: string;
      email: string;
      phone: string;
      address: string;
      unit?: string;
      city: string;
      state: string;
      zipcode: string;
    };
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    service?: {
      name?: string;
      base_price?: number;
    };
    booking_services?: BookingService[];
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
        <div className="mb-6">
          <h3 className="text-xl font-bold text-blue-600 mb-2">NEW JOB ASSIGNMENT</h3>
          <p className="text-sm text-gray-600 mb-3">Hero TV Mounting</p>
          <Badge 
            variant="secondary" 
            className="bg-blue-100 text-blue-800 font-normal"
          >
            {job.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Service Details */}
        <div className="mb-6">
          <h4 className="text-base font-bold text-gray-900 mb-3">Service Details:</h4>
          <div className="space-y-2">
            {job.booking_services && job.booking_services.length > 0 ? (
              job.booking_services.map((service, index) => (
                <div key={index} className="text-sm text-gray-700">
                  <div className="font-medium">
                    {service.service_name} × {service.quantity}
                  </div>
                  {service.configuration && (
                    <div className="ml-4 mt-1 space-y-1 text-gray-600">
                      {service.configuration.wallType && (
                        <div>• Wall Type: {service.configuration.wallType}</div>
                      )}
                      {service.configuration.tvSize && (
                        <div>• TV Size: {service.configuration.tvSize}"</div>
                      )}
                      {service.configuration.mountType && (
                        <div>• Mount Type: {service.configuration.mountType}</div>
                      )}
                      {service.configuration.cableManagement && (
                        <div>• Cable Management: Yes</div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-700">
                {job.service?.name || 'Service details unavailable'}
              </div>
            )}
          </div>
        </div>

        {/* Date & Time */}
        <div className="mb-6">
          <h4 className="text-base font-bold text-gray-900 mb-2">Date & Time:</h4>
          <p className="text-sm text-gray-700">
            {formatDate(job.scheduled_date)}, {formatTime(job.scheduled_start)}
          </p>
        </div>

        {/* Customer Information */}
        <div className="mb-6">
          <h4 className="text-base font-bold text-gray-900 mb-3">Customer Information:</h4>
          <div className="space-y-1 text-sm text-gray-700">
            {/* Determine customer info source */}
            {(() => {
              const customerInfo = job.guest_customer_info || job.customer;
              const customerName = job.guest_customer_info?.name || job.customer?.name;
              const customerEmail = job.guest_customer_info?.email || job.customer?.email;
              const customerPhone = job.guest_customer_info?.phone || job.customer?.phone;
              const customerAddress = job.guest_customer_info?.address;
              const customerUnit = job.guest_customer_info?.unit;
              const customerCity = job.guest_customer_info?.city;
              const customerState = job.guest_customer_info?.state;
              const customerZipcode = job.guest_customer_info?.zipcode;

              return (
                <>
                  {customerName && (
                    <div><span className="font-medium">Name:</span> {customerName}</div>
                  )}
                  {customerAddress && (
                    <div><span className="font-medium">Address:</span> {customerAddress}</div>
                  )}
                  {customerUnit && (
                    <div><span className="font-medium">Unit:</span> {customerUnit}</div>
                  )}
                  {(customerCity || customerState || customerZipcode) && (
                    <div>
                      <span className="font-medium">City:</span> {customerCity}, {customerState} {customerZipcode}
                    </div>
                  )}
                  {customerPhone && (
                    <div><span className="font-medium">Phone:</span> {customerPhone}</div>
                  )}
                  {customerEmail && (
                    <div><span className="font-medium">Email:</span> {customerEmail}</div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Notes/Special Instructions */}
        {(job.location_notes || job.special_instructions) && (
          <div className="mb-6">
            <h4 className="text-base font-bold text-gray-900 mb-2">Notes:</h4>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              {job.location_notes || job.special_instructions}
            </div>
          </div>
        )}

        {/* Important Reminders */}
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-600 rounded-r-lg">
          <h4 className="text-base font-bold text-gray-900 mb-3">Important Reminders:</h4>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Arrive 15 minutes early for setup</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Bring all necessary tools and equipment</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Contact customer if running late</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Complete job documentation after service</span>
            </li>
          </ul>
        </div>

        {/* Support Contact */}
        <div className="mb-6 pt-4 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-900 mb-2">Support Contact:</p>
          <div className="text-sm text-gray-700 space-y-1">
            <div>Email: Captain@herotvmounting.com</div>
            <div>Phone: +1 737-272-9971</div>
          </div>
          <p className="text-sm text-gray-600 mt-2">Good luck with your assignment!</p>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-100">
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
