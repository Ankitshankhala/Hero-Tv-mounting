import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, CreditCard, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { formatBookingTimeForContext } from '@/utils/timeUtils';
import { getJobAddress, getJobInstructions } from '@/utils/jobAddress';

import JobActions from './JobActions';
import { RemoveServicesModal } from './RemoveServicesModal';
import OnSiteChargeModal from './OnSiteChargeModal';
import { AddServicesModal } from './AddServicesModal';
import { JobEarningsCard } from './JobEarningsCard';

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

  const specialInstructions = getJobInstructions(job);

  // Get tip display information
  const getTipDisplay = (tipAmount: number | undefined, paymentStatus: string) => {
    if (!tipAmount || tipAmount <= 0) return null;

    switch (paymentStatus?.toLowerCase()) {
      case 'authorized':
        return {
          text: `Tip: $${tipAmount.toFixed(2)} (Authorized)`,
          color: 'bg-action-warning text-white border-action-warning',
          Icon: CreditCard,
          description: 'Will be charged when service is completed',
        };
      case 'captured':
      case 'completed':
        return {
          text: `Tip: $${tipAmount.toFixed(2)} (Received)`,
          color: 'bg-action-success text-white border-action-success',
          Icon: CheckCircle2,
          description: 'Tip has been processed',
        };
      case 'pending':
        return {
          text: `Tip: $${tipAmount.toFixed(2)} (Pending)`,
          color: 'bg-action-info text-white border-action-info',
          Icon: Clock,
          description: 'Processing tip payment',
        };
      default:
        return {
          text: `Tip: $${tipAmount.toFixed(2)}`,
          color: 'bg-muted text-muted-foreground border-border',
          Icon: DollarSign,
          description: 'Tip amount',
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

  const customerName = job.guest_customer_info?.name || job.customer?.name;
  const customerEmail = job.guest_customer_info?.email || job.customer?.email;
  const customerPhone = job.guest_customer_info?.phone || job.customer?.phone;
  const jobAddress = getJobAddress(job);
  const addressLines = jobAddress ? jobAddress.split(/\s*\|\s*/) : [];
  const customerApartmentName = job.guest_customer_info?.apartment_name;
  const customerCity = job.guest_customer_info?.city;
  const customerState = job.guest_customer_info?.state;
  const customerZipcode = job.guest_customer_info?.zipcode;
  const cityLine = [customerCity, customerState].filter(Boolean).join(', ');

  const tipDisplay = getTipDisplay(job.tip_amount, job.payment_status);

  const statusLabel = (job.status || '').replace('_', ' ').toUpperCase();
  const paymentLabel = (job.payment_status || '').replace('_', ' ').toUpperCase();

  return (
    <Card className="bg-card border border-border shadow-md">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground truncate">
              {customerName || 'Customer'}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-medium">
                {statusLabel}
              </Badge>
              {paymentLabel && (
                <Badge variant="outline" className="text-[10px] font-medium">
                  {paymentLabel}
                </Badge>
              )}
              {tipDisplay && (
                <Badge variant="outline" className={`text-[10px] font-medium ${tipDisplay.color}`}>
                  Tip ${job.tip_amount.toFixed(2)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 shrink-0">
            <div className="text-right text-xs">
              <div className="font-medium text-foreground whitespace-nowrap">
                {getFormattedDate()}
              </div>
              <div className="text-muted-foreground whitespace-nowrap">
                {getFormattedTime()}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapse}
              className="h-8 w-8"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Two-column facts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Service */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Service
            </div>
            <div className="text-[13px] leading-snug">
              {renderServiceDetails()}
            </div>
          </div>

          {/* Customer */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Customer
            </div>
            <dl className="space-y-1 text-[13px]">
              {customerName && (
                <div className="flex gap-2">
                  <dt className="text-[12px] text-muted-foreground w-14 shrink-0">Name</dt>
                  <dd className="text-foreground min-w-0 break-words">{customerName}</dd>
                </div>
              )}
              {addressLines.length > 0 && (
                <div className="flex gap-2">
                  <dt className="text-[12px] text-muted-foreground w-14 shrink-0">Address</dt>
                  <dd className="text-foreground min-w-0 break-words">
                    {addressLines.map((line, i) => (
                      <span key={i} className="block">{line}</span>
                    ))}
                  </dd>
                </div>
              )}
              {customerApartmentName && !job.location_notes && (
                <div className="flex gap-2">
                  <dt className="text-[12px] text-muted-foreground w-14 shrink-0">Apt</dt>
                  <dd className="text-foreground min-w-0 break-words">{customerApartmentName}</dd>
                </div>
              )}
              {cityLine && (
                <div className="flex gap-2">
                  <dt className="text-[12px] text-muted-foreground w-14 shrink-0">City</dt>
                  <dd className="text-foreground min-w-0 break-words">{cityLine}</dd>
                </div>
              )}
              {customerZipcode && (
                <div className="flex gap-2">
                  <dt className="text-[12px] text-muted-foreground w-14 shrink-0">ZIP</dt>
                  <dd className="text-foreground min-w-0 break-words">{customerZipcode}</dd>
                </div>
              )}
              {customerPhone && (
                <div className="flex gap-2">
                  <dt className="text-[12px] text-muted-foreground w-14 shrink-0">Phone</dt>
                  <dd className="text-foreground min-w-0 break-words">{customerPhone}</dd>
                </div>
              )}
              {customerEmail && (
                <div className="flex gap-2">
                  <dt className="text-[12px] text-muted-foreground w-14 shrink-0">Email</dt>
                  <dd className="text-foreground min-w-0 break-all">{customerEmail}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Earnings */}
        {job.booking_services && job.booking_services.length > 0 && (
          <JobEarningsCard
            services={job.booking_services}
            tipAmount={job.tip_amount || 0}
          />
        )}

        {/* Special instructions — only when present */}
        {specialInstructions && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Special instructions
            </div>
            <div className="p-3 bg-muted/40 border border-border rounded-md text-[13px] text-foreground">
              {specialInstructions}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 border-t border-border">
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
