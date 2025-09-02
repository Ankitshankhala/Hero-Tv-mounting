import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBookingTimeForContext, getUserTimezone } from '@/utils/timezoneUtils';


interface CompactJobCardProps {
  job: any;
  isExpanded: boolean;
  onToggle: () => void;
  onCall: () => void;
  onDirections: () => void;
}

export const CompactJobCard = ({ job, isExpanded, onToggle, onCall, onDirections }: CompactJobCardProps) => {
  // Format date and time for compact display using the worker's timezone
  const formatCompactDateTime = (booking: any) => {
    try {
      const workerTimezone = getUserTimezone();
      return formatBookingTimeForContext(booking, 'worker', workerTimezone);
    } catch (error) {
      console.error('Error formatting booking date/time:', { booking, error });
      return 'Invalid date';
    }
  };

  // Get all service lines with quantities
  const getServiceLines = () => {
    if (job.booking_services && job.booking_services.length > 0) {
      return job.booking_services.map((service: any) => 
        `${service.service_name} × ${service.quantity}`
      );
    }
    return [job.service?.name || 'Service'];
  };

  // Get customer name
  const getCustomerName = () => {
    return job.guest_customer_info?.name || job.customer?.name || 'Customer';
  };

  // Get short address
  const getShortAddress = () => {
    if (job.guest_customer_info?.address) {
      const address = job.guest_customer_info.address;
      const city = job.guest_customer_info.city;
      return `${address}${city ? `, ${city}` : ''}`;
    }
    return job.customer_address || 'Address not available';
  };

  // Get status color using design system
  const getStatusColor = (status: string, isArchived: boolean = false) => {
    // For archived jobs, always show as completed
    if (isArchived) {
      return 'bg-status-completed text-white border-status-completed';
    }
    
    switch (status.toLowerCase()) {
      case 'scheduled':
        return 'bg-status-confirmed text-white border-status-confirmed';
      case 'in_progress':
        return 'bg-status-progress text-white border-status-progress';
      case 'completed':
        return 'bg-status-completed text-white border-status-completed';
      case 'cancelled':
        return 'bg-status-cancelled text-white border-status-cancelled';
      default:
        return 'bg-status-pending text-white border-status-pending';
    }
  };

  // Get display status text
  const getDisplayStatus = (status: string, isArchived: boolean = false) => {
    if (isArchived) {
      return 'COMPLETED';
    }
    return status.replace('_', ' ').toUpperCase();
  };

  // Get payment status display
  const getPaymentStatusDisplay = (paymentStatus: string, isArchived: boolean = false) => {
    if (isArchived) {
      return {
        text: 'PAYMENT ACCEPTED',
        color: 'bg-action-success text-white border-action-success'
      };
    }
    
    switch (paymentStatus?.toLowerCase()) {
      case 'authorized':
        return {
          text: 'AUTHORIZED',
          color: 'bg-action-warning text-white border-action-warning'
        };
      case 'captured':
      case 'completed':
        return {
          text: 'PAYMENT CAPTURED',
          color: 'bg-action-success text-white border-action-success'
        };
      case 'pending':
        return {
          text: 'PAYMENT PENDING',
          color: 'bg-action-info text-white border-action-info'
        };
      case 'failed':
      case 'cancelled':
        return {
          text: 'PAYMENT FAILED',
          color: 'bg-destructive text-white border-destructive'
        };
      default:
        return {
          text: paymentStatus?.toUpperCase() || 'UNKNOWN',
          color: 'bg-muted text-muted-foreground border-muted'
        };
    }
  };

  // Check if this is a new job (within last 24 hours)
  const isNewJob = () => {
    const jobTime = new Date(job.created_at).getTime();
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return jobTime > dayAgo;
  };

  // Get time since creation for display
  const getTimeSinceCreation = () => {
    const jobTime = new Date(job.created_at);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - jobTime.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return jobTime.toLocaleDateString();
  };

  // Get status dot color
  const getStatusDotClass = (status: string, isArchived: boolean = false) => {
    if (isArchived) {
      return 'bg-status-completed';
    }
    
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'scheduled':
      case 'in_progress':
        return 'bg-status-confirmed';
      case 'completed':
        return 'bg-status-completed';
      case 'cancelled':
        return 'bg-status-cancelled';
      default:
        return 'bg-status-pending';
    }
  };

  // Get payment dot color
  const getPaymentDotClass = (paymentStatus: string, booking: any, isArchived: boolean = false) => {
    if (isArchived) {
      return 'bg-action-success';
    }
    
    if (paymentStatus === 'authorized' || booking.status === 'payment_authorized') {
      return 'bg-action-warning';
    }
    
    switch (paymentStatus?.toLowerCase()) {
      case 'captured':
      case 'completed':
        return 'bg-action-success';
      case 'pending':
        return 'bg-action-info';
      case 'failed':
      case 'cancelled':
        return 'bg-destructive';
      default:
        return 'bg-muted';
    }
  };

  const isArchived = job.is_archived;
  const paymentStatus = getPaymentStatusDisplay(job.payment_status, isArchived);

  return (
    <Card className={`
      transition-all duration-200 ease-in-out cursor-pointer
      hover:shadow-md hover:scale-[1.01]
      ${isExpanded ? 'shadow-lg ring-2 ring-primary/20' : 'shadow-sm hover:shadow-md'}
      bg-card border border-border
    `}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Status and Service */}
          <div className="flex-1 min-w-0 pr-4">
            {/* Mobile: Status and payment dots with name */}
            <div className="sm:hidden">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div 
                    className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(job.status, isArchived)}`}
                    title={getDisplayStatus(job.status, isArchived)}
                  >
                    <span className="sr-only">{getDisplayStatus(job.status, isArchived)}</span>
                  </div>
                  <div 
                    className={`h-2.5 w-2.5 rounded-full ${getPaymentDotClass(job.payment_status, job, isArchived)}`}
                    title={paymentStatus.text}
                  >
                    <span className="sr-only">{paymentStatus.text}</span>
                  </div>
                </div>
                <div className="text-sm font-medium text-foreground min-w-0 flex-1 truncate whitespace-nowrap">
                  {getCustomerName()}
                </div>
              </div>
            </div>
            
            {/* Desktop: Horizontal layout */}
            <div className="hidden sm:flex items-center gap-3 mb-1">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge 
                  variant="outline" 
                  className={`text-xs font-medium ${getStatusColor(job.status, isArchived)}`}
                >
                  {getDisplayStatus(job.status, isArchived)}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={`text-xs font-medium ${paymentStatus.color}`}
                >
                  {paymentStatus.text}
                </Badge>
                {isNewJob() && !isArchived && (
                  <Badge 
                    variant="outline" 
                    className="text-xs font-medium bg-action-info text-white border-action-info"
                  >
                    NEW
                  </Badge>
                )}
              </div>
              <span className="text-sm font-medium text-foreground truncate">
                {getCustomerName()}
              </span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {getServiceLines().map((serviceLine, index) => (
                <div key={index} className="break-words sm:truncate">
                  {serviceLine}
                </div>
              ))}
            </div>
          </div>

          {/* Center: Date/Time and Address */}
          <div className="flex-1 min-w-0 hidden sm:block">
            <div className="text-sm font-medium text-foreground">
              {formatCompactDateTime(job)}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {getShortAddress()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {isArchived ? `Completed ${new Date(job.archived_at).toLocaleDateString()}` : `Received ${getTimeSinceCreation()}`}
            </div>
          </div>

          {/* Right: Quick Actions and Expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onCall();
                }}
                className="h-8 w-8 p-0"
              >
                <Phone className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDirections();
                }}
                className="h-8 w-8 p-0"
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-8 w-8 p-0"
            >
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`} />
            </Button>
          </div>
        </div>

        {/* Mobile: Show date/address below on small screens */}
        <div className="sm:hidden mt-2 pt-2 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {formatCompactDateTime(job)}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {getShortAddress()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {isArchived ? `Completed ${new Date(job.archived_at).toLocaleDateString()}` : `Received ${getTimeSinceCreation()}`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};