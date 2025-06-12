
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, DollarSign, RefreshCw } from 'lucide-react';
import PaymentDetailsModal from './PaymentDetailsModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const PaymentsManager = () => {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          booking:bookings!inner(
            id,
            customer_address,
            users!customer_id(name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedPayments = data?.map(transaction => ({
        id: transaction.id,
        bookingId: transaction.booking?.id || 'N/A',
        customer: transaction.booking?.users?.name || 'Unknown',
        amount: `$${transaction.amount?.toFixed(2) || '0.00'}`,
        fee: `$${(transaction.amount * 0.03)?.toFixed(2) || '0.00'}`,
        net: `$${(transaction.amount * 0.97)?.toFixed(2) || '0.00'}`,
        method: transaction.payment_method || 'Unknown',
        status: transaction.status,
        date: new Date(transaction.created_at).toLocaleDateString(),
        stripeId: transaction.stripe_payment_id
      })) || [];

      setPayments(transformedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: "Error",
        description: "Failed to load payment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      success: { label: 'Completed', variant: 'default' as const },
      pending: { label: 'Pending', variant: 'secondary' as const },
      failed: { label: 'Failed', variant: 'destructive' as const },
      refunded: { label: 'Refunded', variant: 'outline' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleViewDetails = (payment: any) => {
    setSelectedPayment(payment);
    setIsDetailsModalOpen(true);
  };

  const filteredPayments = payments.filter(payment => {
    const matchesFilter = filterType === 'all' || payment.status === filterType;
    const matchesSearch = payment.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.bookingId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate metrics from actual data
  const totalRevenue = payments.reduce((sum, p) => sum + (parseFloat(p.amount.replace('$', '')) || 0), 0);
  const totalFees = payments.reduce((sum, p) => sum + (parseFloat(p.fee.replace('$', '')) || 0), 0);
  const refundedAmount = payments
    .filter(p => p.status === 'refunded')
    .reduce((sum, p) => sum + (parseFloat(p.amount.replace('$', '')) || 0), 0);
  const refundCount = payments.filter(p => p.status === 'refunded').length;
  const netIncome = totalRevenue - totalFees - refundedAmount;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 animate-pulse rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="h-64 bg-gray-200 animate-pulse rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-600">Total Revenue</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">${totalRevenue.toFixed(2)}</div>
            <div className="text-sm text-gray-600">{payments.length} transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-600">Stripe Fees</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">${totalFees.toFixed(2)}</div>
            <div className="text-sm text-gray-600">3% of total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-gray-600">Refunds</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">${refundedAmount.toFixed(2)}</div>
            <div className="text-sm text-gray-600">{refundCount} transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-gray-600">Net Income</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">${netIncome.toFixed(2)}</div>
            <div className="text-sm text-green-600">After fees & refunds</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payment Transactions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="success">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Stripe Fee</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      No payment transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.id.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Button variant="link" className="p-0 h-auto">
                          {payment.bookingId}
                        </Button>
                      </TableCell>
                      <TableCell>{payment.customer}</TableCell>
                      <TableCell className="font-medium">{payment.amount}</TableCell>
                      <TableCell className="text-red-600">{payment.fee}</TableCell>
                      <TableCell className="font-medium text-green-600">{payment.net}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewDetails(payment)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PaymentDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        payment={selectedPayment}
      />
    </div>
  );
};
