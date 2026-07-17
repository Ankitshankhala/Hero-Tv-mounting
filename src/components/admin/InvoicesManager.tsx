import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Mail, Eye, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceDetailsModal } from './InvoiceDetailsModal';
import { useRealtimeInvoices } from '@/hooks/useRealtimeInvoices';
import { PageHeader } from '@/components/admin/ui/PageHeader';
import { Toolbar } from '@/components/admin/ui/Toolbar';
import { DataTable, type Column } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { EmptyState } from '@/components/admin/ui/EmptyState';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Invoice {
  id: string;
  invoice_number: string;
  booking_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  invoice_date: string;
  status: string;
  email_sent: boolean;
  email_sent_at: string | null;
  customer: { name: string; email: string; phone: string } | null;
  booking: {
    scheduled_date: string;
    guest_customer_info: any;
    service: { name: string };
  } | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const InvoicesManager = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { toast } = useToast();

  const getCustomerName = (invoice: Invoice): string => {
    const guestName = invoice.booking?.guest_customer_info?.name;
    return invoice.customer_name || invoice.customer?.name || guestName || 'Guest Customer';
  };
  const getCustomerEmail = (invoice: Invoice): string => {
    const guestEmail = invoice.booking?.guest_customer_info?.email;
    return invoice.customer_email || invoice.customer?.email || guestEmail || 'N/A';
  };

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:users!invoices_customer_id_fkey(name, email, phone),
          booking:bookings!invoices_booking_id_fkey(
            scheduled_date,
            guest_customer_info,
            service:services(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({ title: 'Error', description: 'Failed to load invoices', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useRealtimeInvoices(fetchInvoices);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const resendInvoiceEmail = async (invoiceId: string, bookingId: string) => {
    try {
      const { error } = await supabase.functions.invoke('generate-invoice', {
        body: { booking_id: bookingId, send_email: true },
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'Invoice email resent successfully' });
      fetchInvoices();
    } catch (error) {
      console.error('Error resending invoice:', error);
      toast({ title: 'Error', description: 'Failed to resend invoice email', variant: 'destructive' });
    }
  };

  const filtered = invoices.filter((inv) => {
    const s = searchTerm.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(s) ||
      getCustomerName(inv).toLowerCase().includes(s) ||
      getCustomerEmail(inv).toLowerCase().includes(s)
    );
  });

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice',
      accessor: (i) => <span className="font-medium">{i.invoice_number}</span>,
      sortable: true,
      sortValue: (i) => i.invoice_number,
    },
    {
      key: 'customer',
      header: 'Customer',
      accessor: (i) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{getCustomerName(i)}</div>
          <div className="text-xs text-muted-foreground truncate">{getCustomerEmail(i)}</div>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      accessor: (i) => i.booking?.service?.name || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (i) => <span className="text-sm text-muted-foreground">{new Date(i.invoice_date).toLocaleDateString()}</span>,
      sortable: true,
      sortValue: (i) => new Date(i.invoice_date).getTime(),
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (i) => formatCurrency(i.amount),
      numeric: true,
      sortable: true,
      sortValue: (i) => Number(i.amount) || 0,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (i) => i.email_sent ? (
        <div>
          <StatusBadge status="sent" variant="success">Sent</StatusBadge>
          {i.email_sent_at && (
            <div className="text-[11px] text-muted-foreground mt-1">
              {new Date(i.email_sent_at).toLocaleDateString()}
            </div>
          )}
        </div>
      ) : <StatusBadge status="not_sent" variant="neutral">Not sent</StatusBadge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      accessor: (i) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setSelectedInvoice(i); setShowDetailsModal(true); }}>
                <Eye className="h-4 w-4 mr-2" />View details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => resendInvoiceEmail(i.id, i.booking_id)}>
                <Mail className="h-4 w-4 mr-2" />Resend email
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Invoices" subtitle="Generated invoices and email delivery status" />

      <Toolbar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by invoice number, customer name, or email..."
      />

      <Card className="p-4 border-border shadow-sm">
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(i) => i.id}
          loading={loading}
          pageSize={20}
          empty={
            <EmptyState
              icon={FileText}
              title={searchTerm ? 'No invoices found' : 'No invoices yet'}
              description={searchTerm ? 'Try a different search term.' : 'Invoices will appear here once generated.'}
            />
          }
        />
      </Card>

      {showDetailsModal && selectedInvoice && (
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          isOpen={showDetailsModal}
          onClose={() => { setShowDetailsModal(false); setSelectedInvoice(null); }}
        />
      )}
    </>
  );
};
