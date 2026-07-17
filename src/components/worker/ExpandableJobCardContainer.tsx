import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CompactJobCard } from './CompactJobCard';
import { ExpandedJobCard } from './ExpandedJobCard';
import { openDirections } from '@/utils/maps';
import { getJobAddress } from '@/utils/jobAddress';

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
    const base = getJobAddress(job, { singleLine: true });
    const g = job.guest_customer_info || {};
    // If we got the address from location_notes, it may not include city/zip.
    const hasLocationNotes = !!job.location_notes;
    let address = base || '';
    if (hasLocationNotes) {
      const suffix = [g.city, g.state, g.zipcode].filter(Boolean).join(', ');
      if (suffix && address && !address.includes(g.zipcode || '___')) {
        address = `${address}, ${suffix}`;
      }
    }
    if (!address && job.customer_address) address = job.customer_address;

    if (address) {
      openDirections(address);
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