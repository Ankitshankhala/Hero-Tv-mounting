import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CompactJobCard } from './CompactJobCard';
import { ExpandedJobCard } from './ExpandedJobCard';

interface ExpandableJobCardContainerProps {
  job: any;
  onStatusUpdate: (jobId: string, newStatus: string) => void;
  onJobCancelled: () => void;
}

export const ExpandableJobCardContainer = ({ 
  job, 
  onStatusUpdate, 
  onJobCancelled 
}: ExpandableJobCardContainerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  // Quick action handlers
  const handleCall = () => {
    const customerPhone = job.guest_customer_info?.phone || job.customer?.phone;
    if (customerPhone) {
      window.open(`tel:${customerPhone}`, '_self');
    }
  };

  const handleDirections = () => {
    let address = '';
    if (job.guest_customer_info?.address) {
      const { address: addr, city, state, zipcode } = job.guest_customer_info;
      address = `${addr}, ${city}, ${state} ${zipcode}`;
    } else if (job.customer_address) {
      address = job.customer_address;
    }
    
    if (address) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      window.open(mapsUrl, '_blank');
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <div>
          <CompactJobCard
            job={job}
            isExpanded={isExpanded}
            onToggle={handleToggle}
            onCall={handleCall}
            onDirections={handleDirections}
          />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4 animate-accordion-down">
        <ExpandedJobCard
          job={job}
          onStatusUpdate={onStatusUpdate}
          onJobCancelled={onJobCancelled}
          onCollapse={handleCollapse}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};