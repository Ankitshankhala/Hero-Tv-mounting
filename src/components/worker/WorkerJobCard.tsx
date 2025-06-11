
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import JobHeader from './JobHeader';
import JobDetails from './JobDetails';
import JobInstructions from './JobInstructions';
import JobActions from './JobActions';
import InvoiceModificationModal from './InvoiceModificationModal';
import CancellationModal from './CancellationModal';
import OnSiteChargeModal from './OnSiteChargeModal';
import PaymentCollectionModal from './PaymentCollectionModal';

interface WorkerJobCardProps {
  job: any;
  onStatusUpdate: (jobId: string, newStatus: string) => void;
  onJobCancelled?: () => void;
}

const WorkerJobCard = ({ job, onStatusUpdate, onJobCancelled }: WorkerJobCardProps) => {
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleModificationCreated = () => {
    // Refresh the job data or trigger a re-fetch
    window.location.reload();
  };

  const handleCancellationSuccess = () => {
    if (onJobCancelled) {
      onJobCancelled();
    }
  };

  const handleChargeSuccess = () => {
    // Refresh the job data
    window.location.reload();
  };

  const handlePaymentCollected = () => {
    // Refresh the job data
    window.location.reload();
  };

  return (
    <>
      <Card className="bg-slate-700 border-slate-600">
        <CardContent className="p-6">
          <JobHeader job={job} />
          <JobDetails job={job} />
          <JobInstructions job={job} />
          <JobActions
            job={job}
            onStatusUpdate={onStatusUpdate}
            onModifyClick={() => setShowModifyModal(true)}
            onCancelClick={() => setShowCancelModal(true)}
            onChargeClick={() => setShowChargeModal(true)}
            onCollectPaymentClick={() => setShowPaymentModal(true)}
          />
        </CardContent>
      </Card>

      <InvoiceModificationModal
        isOpen={showModifyModal}
        onClose={() => setShowModifyModal(false)}
        job={job}
        onModificationCreated={handleModificationCreated}
      />

      <CancellationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        job={job}
        onCancellationSuccess={handleCancellationSuccess}
      />

      <OnSiteChargeModal
        isOpen={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        job={job}
        onChargeSuccess={handleChargeSuccess}
      />

      <PaymentCollectionModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        job={job}
        onPaymentCollected={handlePaymentCollected}
      />
    </>
  );
};

export default WorkerJobCard;
