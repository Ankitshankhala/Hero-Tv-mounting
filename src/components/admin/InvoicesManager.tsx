
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Mail, Search, Eye, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceDetailsModal } from './InvoiceDetailsModal';

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

export const InvoicesManager = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:users!invoices_customer_id_fkey(name, email, phone),
          booking:bookings!invoices_booking_id_fkey(
            scheduled_date,
            service:services(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInvoice = async (bookingId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { booking_id: bookingId, send_email: true }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice generated and sent successfully",
      });
      
      fetchInvoices();
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to generate invoice",
        variant: "destructive",
      });
    }
  };

  const resendInvoiceEmail = async (invoiceId: string, bookingId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { booking_id: bookingId, send_email: true }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice email resent successfully",
      });
      
      fetchInvoices();
    } catch (error) {
      console.error('Error resending invoice:', error);
      toast({
        title: "Error",
        description: "Failed to resend invoice email",
        variant: "destructive",
      });
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (invoice.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (invoice.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Invoice Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by invoice number, customer name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email Sent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                     <TableCell>
                       <div>
                         <div className="font-medium">{invoice.customer?.name || 'N/A'}</div>
                         <div className="text-sm text-gray-500">{invoice.customer?.email || 'N/A'}</div>
                       </div>
                     </TableCell>
                     <TableCell>{invoice.booking?.service?.name || 'N/A'}</TableCell>
                    <TableCell>
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      {invoice.email_sent ? (
                        <div>
                          <Badge variant="outline" className="text-green-600">
                            Sent
                          </Badge>
                          {invoice.email_sent_at && (
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(invoice.email_sent_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary">Not Sent</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowDetailsModal(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resendInvoiceEmail(invoice.id, invoice.booking_id)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredInvoices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No invoices found matching your search criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {showDetailsModal && selectedInvoice && (
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
};
