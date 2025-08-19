
import React from 'react';
import { RemoveServicesModal } from './RemoveServicesModal';

interface InvoiceModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onModificationCreated: () => void;
}

const InvoiceModificationModal = (props: InvoiceModificationModalProps) => {
  return <RemoveServicesModal {...props} />;
};

export default InvoiceModificationModal;
