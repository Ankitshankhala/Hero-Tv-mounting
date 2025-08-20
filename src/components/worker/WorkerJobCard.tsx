
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import JobActions from './JobActions';
import { RemoveServicesModal } from './RemoveServicesModal';
import OnSiteChargeModal from './OnSiteChargeModal';
import { AddServicesModal } from './AddServicesModal';
import PaymentCollectionModal from './payment/PaymentCollectionModal';

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
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleModifyClick = () => setShowModifyModal(true);
  const handleChargeClick = () => {
    // If payment failed/cancelled, show payment collection modal
    if (job.payment_status === 'failed' || job.payment_status === 'cancelled') {
      setShowPaymentModal(true);
    } else {
      // Otherwise show onsite charge modal
      setShowChargeModal(true);
    }
  };
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

  const handlePaymentCollected = () => {
    setShowPaymentModal(false);
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

  // Extract special instructions from location_notes or special_instructions field
  const getSpecialInstructions = () => {
    // First check if there's a dedicated special_instructions field
    if (job.special_instructions && job.special_instructions.trim()) {
      return job.special_instructions.trim();
    }

    // Then check location_notes for special instructions
    if (job.location_notes) {
      const specialInstructionsIndex = job.location_notes.indexOf('Special Instructions:');
      if (specialInstructionsIndex !== -1) {
        const instructions = job.location_notes
          .substring(specialInstructionsIndex + 'Special Instructions:'.length)
          .trim();
        return instructions || null;
      }
    }

    return null;
  };

  const specialInstructions = getSpecialInstructions();

  // Group TV Mounting services with their add-ons
  const groupTvMountingServices = (services: BookingService[]) => {
    const tvMountingService = services.find(s => s.service_name === 'TV Mounting');
    const addOnServices = services.filter(s => 
      s.service_name !== 'TV Mounting' && (
        s.service_name.includes('Add-on') ||
        s.service_name.includes('Over 65') ||
        s.service_name.includes('Frame Mount') ||
        s.service_name.includes('Special Wall') ||
        s.service_name.includes('Soundbar')
      )
    );
    const otherServices = services.filter(s => 
      s.service_name !== 'TV Mounting' && !addOnServices.includes(s)
    );

    return { tvMountingService, addOnServices, otherServices };
  };

  const renderServiceDetails = () => {
    if (!job.booking_services || job.booking_services.length === 0) {
      return (
        <div className="text-xs text-gray-700">
          {job.service?.name || 'Service details unavailable'}
        </div>
      );
    }

    // Show all services with quantities
    return (
      <div className="space-y-1">
        {job.booking_services.map((service, index) => (
          <div key={index} className="text-xs text-gray-700">
            <div className="font-medium">
              {service.service_name} × {service.quantity}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-white border border-gray-200 rounded-lg">
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-primary mb-1">NEW JOB ASSIGNMENT</h3>
          <p className="text-xs text-muted-foreground mb-2">Hero TV Mounting</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="secondary" 
              className="bg-primary/10 text-primary font-normal text-xs"
            >
              {job.status.replace('_', ' ').toUpperCase()}
            </Badge>
            {job.payment_status && (
              <Badge 
                variant={
                  job.payment_status === 'captured' || job.payment_status === 'completed' 
                    ? 'default' 
                    : job.payment_status === 'failed' || job.payment_status === 'cancelled'
                    ? 'destructive'
                    : 'outline'
                }
                className="text-xs"
              >
                {job.payment_status === 'captured' ? 'Payment Captured' :
                 job.payment_status === 'completed' ? 'Payment Complete' :
                 job.payment_status === 'authorized' ? 'Payment Authorized' :
                 job.payment_status === 'failed' ? 'Payment Failed' :
                 job.payment_status === 'cancelled' ? 'Payment Cancelled' :
                 `Payment ${job.payment_status}`}
              </Badge>
            )}
          </div>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Service Details - Left */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">Service Details:</h4>
            {renderServiceDetails()}
          </div>

          {/* Date & Time - Middle */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">Date & Time:</h4>
            <div className="text-xs text-gray-700">
              <div className="font-medium">{formatDate(job.scheduled_date)}</div>
              <div>{formatTime(job.scheduled_start)}</div>
            </div>
          </div>

          {/* Customer Information - Right */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">Customer Information:</h4>
            <div className="space-y-0.5 text-xs text-gray-700">
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
        </div>

        {/* Special Instructions - Always Show */}
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-900 mb-2">Special Instructions:</h4>
          <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
            {specialInstructions || "No special instructions provided"}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-gray-100">
          <JobActions
            job={job}
            onStatusUpdate={onStatusUpdate || (() => {})}
            onModifyClick={handleModifyClick}
            onChargeClick={handleChargeClick}
            onCaptureSuccess={handleCaptureSuccess}
            onAddServicesClick={handleAddServicesClick}
            onModifyServicesClick={handleModifyClick}
          />
        </div>
      </CardContent>

      {/* Modals */}
      {showModifyModal && (
        <RemoveServicesModal
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

      {showPaymentModal && (
        <PaymentCollectionModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          job={job}
          onPaymentCollected={handlePaymentCollected}
        />
      )}
    </Card>
  );
};
