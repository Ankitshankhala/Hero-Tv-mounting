
import React from 'react';
import { EnhancedInvoiceModificationModal } from './EnhancedInvoiceModificationModal';

interface InvoiceModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onModificationCreated: () => void;
}

const InvoiceModificationModal = (props: InvoiceModificationModalProps) => {
  return <EnhancedInvoiceModificationModal {...props} />;
};

export default InvoiceModificationModal;
