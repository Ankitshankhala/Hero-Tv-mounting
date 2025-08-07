
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Mail, Download } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  booking_id: string;
  customer_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  invoice_date: string;
  status: string;
  email_sent: boolean;
  email_sent_at: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  booking: {
    scheduled_date: string;
    service: {
      name: string;
    };
  };
}

interface InvoiceDetailsModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceDetailsModal = ({ invoice, isOpen, onClose }: InvoiceDetailsModalProps) => {
  if (!invoice) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default">Sent</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'paid':
        return <Badge variant="outline">Paid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Invoice Details - {invoice.invoice_number}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-4">
          {/* Invoice Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Hero TV Mounting</h2>
              <p className="text-gray-600">Professional TV Mounting & Installation Services</p>
            </div>
            <div className="text-right">
              <h3 className="text-xl font-semibold">INVOICE</h3>
              <p className="text-gray-600">{invoice.invoice_number}</p>
              {getStatusBadge(invoice.status)}
            </div>
          </div>

          {/* Invoice & Customer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">Invoice Details</h4>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Invoice Date:</span> {new Date(invoice.invoice_date).toLocaleDateString()}</p>
                <p><span className="font-medium">Service Date:</span> {new Date(invoice.booking.scheduled_date).toLocaleDateString()}</p>
                <p><span className="font-medium">Booking ID:</span> {invoice.booking_id}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">Bill To</h4>
              <div className="text-sm space-y-1">
                <p className="font-medium">{invoice.customer.name}</p>
                <p>{invoice.customer.email}</p>
                <p>{invoice.customer.phone}</p>
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Service Details</h4>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{invoice.booking.service.name}</TableCell>
                    <TableCell>Professional TV mounting and installation service</TableCell>
                    <TableCell className="text-right">1</TableCell>
                    <TableCell className="text-right">${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${invoice.amount.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${invoice.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>${invoice.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>${invoice.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Email Status */}
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Email Status</h4>
            <div className="flex items-center space-x-4">
              {invoice.email_sent ? (
                <>
                  <Badge variant="outline" className="text-green-600">
                    Email Sent
                  </Badge>
                  {invoice.email_sent_at && (
                    <span className="text-sm text-gray-600">
                      Sent on {new Date(invoice.email_sent_at).toLocaleString()}
                    </span>
                  )}
                </>
              ) : (
                <Badge variant="secondary">Email Not Sent</Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Resend Email
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
