import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompactJobCardProps {
  job: any;
  isExpanded: boolean;
  onToggle: () => void;
  onCall: () => void;
  onDirections: () => void;
}

export const CompactJobCard = ({ job, isExpanded, onToggle, onCall, onDirections }: CompactJobCardProps) => {
  // Format date and time for compact display
  const formatCompactDateTime = (date: string, time: string) => {
    const dateObj = new Date(date);
    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const day = dateObj.getDate();
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${month} ${day}, ${displayHour}:${minutes} ${ampm}`;
  };

  // Get primary service name
  const getPrimaryService = () => {
    if (job.booking_services && job.booking_services.length > 0) {
      const tvMounting = job.booking_services.find((s: any) => s.service_name === 'TV Mounting');
      if (tvMounting) {
        return `TV Mounting × ${tvMounting.quantity}`;
      }
      const firstService = job.booking_services[0];
      return `${firstService.service_name} × ${firstService.quantity}`;
    }
    return job.service?.name || 'Service';
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

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
              <Badge 
                variant="outline" 
                className={`text-xs font-medium ${getStatusColor(job.status)}`}
              >
                {job.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <span className="text-sm font-medium text-foreground truncate">
                {getCustomerName()}
              </span>
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {getPrimaryService()}
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