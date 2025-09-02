import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatBookingTimeForContext } from '@/utils/timezoneUtils';
import { formatTimeTo12Hour } from '@/utils/timeUtils';
import { getBookingTimezone } from '@/utils/jobTimeUtils';

import JobActions from './JobActions';
import { RemoveServicesModal } from './RemoveServicesModal';
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

interface ExpandedJobCardProps {
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
      apartment_name?: string;
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
  onCollapse: () => void;
}

export const ExpandedJobCard = ({ job, onStatusUpdate, onJobCancelled, onCollapse }: ExpandedJobCardProps) => {
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

  // Format date and time for display using the booking's timezone
  const formatDate = (date: string) => {
    if (!date) return 'Invalid date';
    
    try {
      const timezone = getBookingTimezone(job);
      return formatBookingTimeForContext(
        { ...job, scheduled_date: date },
        'worker',
        timezone
      );
    } catch (error) {
      console.error('Error formatting date:', { date, error });
      return 'Invalid date';
    }
  };

  const formatTime = (time: string) => {
    if (!time) return 'Invalid time';
    return formatTimeTo12Hour(time);
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
        <div className="text-sm text-muted-foreground">
          {job.service?.name || 'Service details unavailable'}
        </div>
      );
    }

    const { tvMountingService, addOnServices, otherServices } = groupTvMountingServices(job.booking_services);

    return (
      <div className="space-y-2">
        {/* TV Mounting with add-ons */}
        {tvMountingService && (
          <div className="text-sm">
            <div className="font-medium text-foreground">
              {tvMountingService.service_name} × {tvMountingService.quantity}
            </div>
            
            {/* Show add-ons as sub-items */}
            {addOnServices.map((addon, index) => (
              <div key={`addon-${index}`} className="ml-4 text-muted-foreground">
                • {addon.service_name} × {addon.quantity}
              </div>
            ))}
            
            {/* Show configuration for TV mounting */}
            {tvMountingService.configuration && (
              <div className="ml-4 mt-1 space-y-1 text-muted-foreground">
                {tvMountingService.configuration.wallType && (
                  <div>• Wall Type: {tvMountingService.configuration.wallType}</div>
                )}
                {tvMountingService.configuration.tvSize && (
                  <div>• TV Size: {tvMountingService.configuration.tvSize}"</div>
                )}
                {tvMountingService.configuration.mountType && (
                  <div>• Mount Type: {tvMountingService.configuration.mountType}</div>
                )}
                {tvMountingService.configuration.cableManagement && (
                  <div>• Cable Management: Yes</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Other non-TV mounting services */}
        {otherServices.map((service, index) => (
          <div key={`other-${index}`} className="text-sm">
            <div className="font-medium text-foreground">
              {service.service_name} × {service.quantity}
            </div>
            {service.configuration && (
              <div className="ml-4 mt-1 space-y-1 text-muted-foreground">
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
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card border border-border shadow-lg">
      <CardContent className="p-6">
        {/* Header with collapse button */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-primary mb-1">JOB DETAILS</h3>
            <p className="text-sm text-muted-foreground mb-3">Hero TV Mounting</p>
            <Badge 
              variant="secondary" 
              className="font-medium"
            >
              {job.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapse}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Service Details - Left */}
          <div>
            <h4 className="text-lg font-semibold text-foreground mb-3">Service Details</h4>
            {renderServiceDetails()}
          </div>

          {/* Date & Time - Middle */}
          <div>
            <h4 className="text-lg font-semibold text-foreground mb-3">Date & Time</h4>
            <div className="text-sm">
              <div className="font-medium text-foreground">{formatDate(job.scheduled_date)}</div>
              <div className="text-muted-foreground">{formatTime(job.scheduled_start)}</div>
            </div>
          </div>

          {/* Customer Information - Right */}
          <div>
            <h4 className="text-lg font-semibold text-foreground mb-3">Customer Information</h4>
            <div className="space-y-1 text-sm">
              {(() => {
                const customerInfo = job.guest_customer_info || job.customer;
                const customerName = job.guest_customer_info?.name || job.customer?.name;
                const customerEmail = job.guest_customer_info?.email || job.customer?.email;
                const customerPhone = job.guest_customer_info?.phone || job.customer?.phone;
                const customerAddress = job.guest_customer_info?.address;
                const customerUnit = job.guest_customer_info?.unit;
                const customerApartmentName = job.guest_customer_info?.apartment_name;
                const customerCity = job.guest_customer_info?.city;
                const customerState = job.guest_customer_info?.state;
                const customerZipcode = job.guest_customer_info?.zipcode;

                return (
                  <>
                    {customerName && (
                      <div><span className="font-medium">Name:</span> <span className="text-muted-foreground">{customerName}</span></div>
                    )}
                    {customerAddress && (
                      <div><span className="font-medium">Address:</span> <span className="text-muted-foreground">{customerAddress}</span></div>
                    )}
                    {customerUnit && (
                      <div><span className="font-medium">Unit:</span> <span className="text-muted-foreground">{customerUnit}</span></div>
                    )}
                    {customerApartmentName && (
                      <div><span className="font-medium">Apartment:</span> <span className="text-muted-foreground">{customerApartmentName}</span></div>
                    )}
                    {(customerCity || customerState || customerZipcode) && (
                      <div>
                        <span className="font-medium">City:</span> <span className="text-muted-foreground">{customerCity}, {customerState} {customerZipcode}</span>
                      </div>
                    )}
                    {customerPhone && (
                      <div><span className="font-medium">Phone:</span> <span className="text-muted-foreground">{customerPhone}</span></div>
                    )}
                    {customerEmail && (
                      <div><span className="font-medium">Email:</span> <span className="text-muted-foreground">{customerEmail}</span></div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-foreground mb-3">Special Instructions</h4>
          <div className="p-4 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground">
            {specialInstructions || "No special instructions provided"}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-border">
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
    </Card>
  );
};
