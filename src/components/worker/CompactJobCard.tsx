import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBookingTimeForContext } from '@/utils/timezoneUtils';

interface CompactJobCardProps {
  job: any;
  isExpanded: boolean;
  onToggle: () => void;
  onCall: () => void;
  onDirections: () => void;
}

export const CompactJobCard = ({ job, isExpanded, onToggle, onCall, onDirections }: CompactJobCardProps) => {
  // Format date and time for compact display using America/Chicago timezone
  const formatCompactDateTime = (date: string, time: string) => {
    // Create booking object structure for timezone formatter
    const booking = {
      local_service_date: date,
      local_service_time: time,
      service_tz: 'America/Chicago'
    };
    
    return formatBookingTimeForContext(booking, 'worker', 'America/Chicago');
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
  const getStatusColor = (status: string) => {
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs font-medium ${getStatusColor(job.status)}`}
                >
                  {job.status.replace('_', ' ').toUpperCase()}
                </Badge>
                {isNewJob() && (
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
                <div key={index} className="truncate">
                  {serviceLine}
                </div>
              ))}
            </div>
          </div>

          {/* Center: Date/Time and Address */}
          <div className="flex-1 min-w-0 hidden sm:block">
            <div className="text-sm font-medium text-foreground">
              {formatCompactDateTime(job.scheduled_date, job.scheduled_start)}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {getShortAddress()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Received {getTimeSinceCreation()}
            </div>
          </div>

          {/* Right: Quick Actions and Expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
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
            {formatCompactDateTime(job.scheduled_date, job.scheduled_start)}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {getShortAddress()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};