import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Clock, Download, Mail, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeInvoices } from '@/hooks/useRealtimeInvoices';

interface Invoice {
  id: string;
  invoice_number: string;
  booking_id: string;
  customer_id: string;
  amount: number;
  email_sent: boolean;
  delivery_status: string;
  delivery_attempts: number;
  created_at: string;
  last_delivery_attempt: string;
  customer?: {
    name: string;
    email: string;
  };
  booking?: {
    scheduled_date: string;
    status: string;
  };
}

export const InvoiceMonitoringPanel = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingBatch, setProcessingBatch] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:users!invoices_customer_id_fkey(name, email),
          booking:bookings!invoices_booking_id_fkey(scheduled_date, status)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error',
        description: 'Failed to load invoices',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Set up real-time subscription
  useRealtimeInvoices(fetchInvoices);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const retryInvoiceDelivery = async (invoiceId: string) => {
    try {
      const { error } = await supabase.functions.invoke('invoice-retry-handler', {
        body: { invoice_id: invoiceId }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invoice delivery retry initiated',
      });

      fetchInvoices();
    } catch (error) {
      console.error('Error retrying invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to retry invoice delivery',
        variant: 'destructive',
      });
    }
  };

  const generateBatchInvoices = async () => {
    setProcessingBatch(true);
    
    let totalGenerated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let runCount = 0;
    const maxRuns = 10; // Safety cap to prevent infinite loops
    
    try {
      while (runCount < maxRuns) {
        runCount++;
        console.log(`Batch run ${runCount}...`);
        
        const { data, error } = await supabase.functions.invoke('batch-invoice-generator', {
          body: { 
            send_email: true,
            payment_status_filter: 'captured',
            max_bookings: 50
          }
        });

        if (error) throw error;

        totalGenerated += data.generated_count || 0;
        totalFailed += data.failed_count || 0;
        totalSkipped += data.skipped_count || 0;

        console.log(`Run ${runCount} results:`, data);

        // If no invoices were generated, we're done
        if ((data.generated_count || 0) === 0) {
          console.log('No more invoices to generate, stopping batch processing');
          break;
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: 'Batch Processing Complete',
        description: `Generated ${totalGenerated} invoices across ${runCount} runs. ${totalFailed} failed, ${totalSkipped} skipped`,
      });

      fetchInvoices();
    } catch (error) {
      console.error('Error generating batch invoices:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate batch invoices',
        variant: 'destructive',
      });
    } finally {
      setProcessingBatch(false);
    }
  };

  const downloadInvoicePDF = async (bookingId: string, invoiceNumber: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { booking_id: bookingId },
        headers: { 'Accept': 'application/pdf' }
      });

      if (error) throw error;

      // Create download link
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Invoice PDF downloaded',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to download invoice PDF',
        variant: 'destructive',
      });
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    switch (activeTab) {
      case 'pending':
        return invoice.delivery_status === 'pending';
      case 'delivered':
        return invoice.delivery_status === 'delivered';
      case 'failed':
        return invoice.delivery_status === 'failed';
      default:
        return true;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDeliveryStats = () => {
    const delivered = invoices.filter(i => i.delivery_status === 'delivered').length;
    const failed = invoices.filter(i => i.delivery_status === 'failed').length;
    const pending = invoices.filter(i => i.delivery_status === 'pending').length;
    
    return { delivered, failed, pending, total: invoices.length };
  };

  const stats = getDeliveryStats();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Invoice Monitoring & Management</CardTitle>
              <CardDescription>
                Monitor invoice generation and delivery status
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchInvoices} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button 
                onClick={generateBatchInvoices} 
                disabled={processingBatch}
                size="sm"
              >
                <Send className="w-4 h-4 mr-2" />
                {processingBatch ? 'Processing...' : 'Generate Missing Invoices'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
                <p className="text-sm text-muted-foreground">Delivered</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <p className="text-sm text-muted-foreground">Failed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All Invoices</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="delivered">Delivered</TabsTrigger>
              <TabsTrigger value="failed">Failed</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <div className="space-y-4">
                {filteredInvoices.map((invoice) => (
                  <Card key={invoice.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{invoice.invoice_number}</h4>
                            {getStatusBadge(invoice.delivery_status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Customer: {invoice.customer?.name} ({invoice.customer?.email})
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Amount: ${invoice.amount.toFixed(2)} | 
                            Created: {new Date(invoice.created_at).toLocaleDateString()} |
                            Attempts: {invoice.delivery_attempts || 0}
                          </p>
                          {invoice.last_delivery_attempt && (
                            <p className="text-sm text-muted-foreground">
                              Last attempt: {new Date(invoice.last_delivery_attempt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => downloadInvoicePDF(invoice.booking_id, invoice.invoice_number)}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            PDF
                          </Button>
                          {invoice.delivery_status === 'failed' && (
                            <Button
                              onClick={() => retryInvoiceDelivery(invoice.id)}
                              variant="outline"
                              size="sm"
                            >
                              <Mail className="w-4 h-4 mr-1" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {filteredInvoices.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No invoices found</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};