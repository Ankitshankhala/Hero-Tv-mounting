import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatBookingTimeForContext } from '@/utils/timeUtils';

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
    start_time_utc?: string;
    local_service_date?: string;
    local_service_time?: string;
    service_tz?: string;
    status: string;
    payment_status?: string;
    location_notes?: string;
    customer_address?: string;
    pending_payment_amount?: number;
    tip_amount?: number;
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

  // Format date and time using the same logic as CompactJobCard
  const getFormattedDateTime = () => {
    try {
      return formatBookingTimeForContext(job, 'worker', 'America/Chicago');
    } catch (error) {
      console.error('Error formatting booking date/time:', { job, error });
      return 'Invalid date and time';
    }
  };

  const getFormattedDate = () => {
    try {
      const fullDateTime = formatBookingTimeForContext(job, 'worker', 'America/Chicago');
      // Extract just the date part (everything before the first comma after day name)
      const parts = fullDateTime.split(',');
      if (parts.length >= 2) {
        return `${parts[0]}, ${parts[1]}`.trim();
      }
      return fullDateTime.split(' at ')[0] || fullDateTime;
    } catch (error) {
      console.error('Error formatting date:', { job, error });
      return 'Invalid date';
    }
  };

  const getFormattedTime = () => {
    try {
      const fullDateTime = formatBookingTimeForContext(job, 'worker', 'America/Chicago');
      // Extract time part (everything after 'at')
      const timePart = fullDateTime.split(' at ')[1];
      return timePart || fullDateTime.split(', ').pop() || fullDateTime;
    } catch (error) {
      console.error('Error formatting time:', { job, error });
      return 'Invalid time';
    }
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

  // Get tip display information
  const getTipDisplay = (tipAmount: number | undefined, paymentStatus: string) => {
    if (!tipAmount || tipAmount <= 0) return null;
    
    switch (paymentStatus?.toLowerCase()) {
      case 'authorized':
        return {
          text: `Tip: $${tipAmount.toFixed(2)} (Authorized)`,
          color: 'bg-amber-500 text-white border-amber-500',
          icon: '💳',
          description: 'Will be charged when service is completed'
        };
      case 'captured':
      case 'completed':
        return {
          text: `Tip: $${tipAmount.toFixed(2)} (Received)`,
          color: 'bg-green-500 text-white border-green-500',
          icon: '✓',
          description: 'Tip has been processed'
        };
      case 'pending':
        return {
          text: `Tip: $${tipAmount.toFixed(2)} (Pending)`,
          color: 'bg-blue-500 text-white border-blue-500',
          icon: '⏳',
          description: 'Processing tip payment'
        };
      default:
        return {
          text: `Tip: $${tipAmount.toFixed(2)}`,
          color: 'bg-gray-500 text-white border-gray-500',
          icon: '💵',
          description: 'Tip amount'
        };
    }
  };

  // Group Mount TV services with their add-ons
  const groupTvMountingServices = (services: BookingService[]) => {
    const tvMountingService = services.find(s => s.service_name === 'Mount TV');
    const addOnServices = services.filter(s => 
      s.service_name !== 'Mount TV' && (
        s.service_name.includes('Add-on') ||
        s.service_name.includes('Over 65') ||
        s.service_name.includes('Frame Mount') ||
        s.service_name.includes('Special Wall') ||
        s.service_name.includes('Soundbar')
      )
    );
    const otherServices = services.filter(s => 
      s.service_name !== 'Mount TV' && !addOnServices.includes(s)
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
        {/* Mount TV with add-ons */}
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
            
            {/* Show configuration for Mount TV */}
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

        {/* Other non-Mount TV services */}
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
          <div className="flex-1">
            <h3 className="text-xl font-bold text-primary mb-1">JOB DETAILS</h3>
            <p className="text-sm text-muted-foreground mb-3">Hero TV Mounting</p>
            <Badge 
              variant="secondary" 
              className="font-medium"
            >
              {job.status.replace('_', ' ').toUpperCase()}
            </Badge>

            {/* Tip Amount Display */}
            {(() => {
              const tipDisplay = getTipDisplay(job.tip_amount, job.payment_status);
              return tipDisplay && (
                <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{tipDisplay.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                          {tipDisplay.text}
                        </div>
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          {tipDisplay.description}
                        </div>
                      </div>
                    </div>
                    <Badge className={tipDisplay.color}>
                      ${job.tip_amount.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              );
            })()}
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
              <div className="font-medium text-foreground">{getFormattedDate()}</div>
              <div className="text-muted-foreground">{getFormattedTime()}</div>
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
