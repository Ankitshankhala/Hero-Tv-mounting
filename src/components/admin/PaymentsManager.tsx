import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PaymentDetailsModal from './PaymentDetailsModal';
import { PaymentRecoveryTools } from './PaymentRecoveryTools';
import { PaymentSyncButton } from './PaymentSyncButton';
import { StripeSyncButton } from './StripeSyncButton';
import { PaymentHealthCheck } from './PaymentHealthCheck';
import { PaymentCaptureHistory } from './PaymentCaptureHistory';


interface Transaction {
  id: string;
  booking_id: string | null;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  currency: string;
  payment_intent_id?: string;
  booking?: {
    guest_customer_info: {
      name: string;
      email: string;
      phone: string;
      zipcode?: string;
      city?: string;
    };
  } | null;
}

interface PaymentStats {
  totalRevenue: number;
  totalFees: number;
  totalRefunds: number;
  netIncome: number;
  transactionCount: number;
}

export const PaymentsManager = () => {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // New: date range filter
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats>({
    totalRevenue: 0,
    totalFees: 0,
    totalRefunds: 0,
    netIncome: 0,
    transactionCount: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('Transaction change:', payload);
          fetchTransactions(); // Refresh data on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      const { data: transactionsData, error } = await supabase
        .from('transactions')
        .select(`
          id,
          booking_id,
          amount,
          status,
          payment_method,
          payment_intent_id,
          created_at,
          currency,
          booking:bookings(
            guest_customer_info
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        throw error;
      }

      const processedTransactions = (transactionsData || []).map(transaction => ({
        ...transaction,
        booking: Array.isArray(transaction.booking) ? transaction.booking[0] : transaction.booking
      }));

      setTransactions(processedTransactions);
      calculateStats(processedTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Error",
        description: "Failed to load payment transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (transactions: Transaction[]) => {
    const stats = transactions.reduce(
      (acc, transaction) => {
        const amount = Number(transaction.amount) || 0;
        
        if (transaction.status === 'completed' || transaction.status === 'success') {
          acc.totalRevenue += amount;
          // Estimate Stripe fees at 2.9% + $0.30
          acc.totalFees += (amount * 0.029) + 0.30;
        } else if (transaction.status === 'refunded') {
          acc.totalRefunds += amount;
        }
        
        acc.transactionCount++;
        return acc;
      },
      { totalRevenue: 0, totalFees: 0, totalRefunds: 0, netIncome: 0, transactionCount: 0 }
    );

    stats.netIncome = stats.totalRevenue - stats.totalFees - stats.totalRefunds;
    setPaymentStats(stats);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: 'Completed', variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      success: { label: 'Success', variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      captured: { label: 'Captured', variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      authorized: { label: 'Authorized', variant: 'secondary' as const, className: 'bg-blue-100 text-blue-800' },
      pending: { label: 'Pending', variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800' },
      failed: { label: 'Failed', variant: 'destructive' as const, className: 'bg-red-100 text-red-800' },
      refunded: { label: 'Refunded', variant: 'outline' as const, className: 'bg-gray-100 text-gray-800' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const handleViewDetails = (payment: any) => {
    setSelectedPayment(payment);
    setIsDetailsModalOpen(true);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesFilter = filterType === 'all' || transaction.status === filterType;
    const customerName = transaction.booking?.guest_customer_info?.name || '';
    const customerEmail = transaction.booking?.guest_customer_info?.email || '';
    const matchesSearch = customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (transaction.booking_id && transaction.booking_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Date filtering
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const transactionDate = new Date(transaction.created_at);
      const now = new Date();
      
      if (dateFilter === 'august') {
        matchesDate = transactionDate.getMonth() === 7 && transactionDate.getFullYear() === 2024;
      } else if (dateFilter === 'september') {
        matchesDate = transactionDate.getMonth() === 8 && transactionDate.getFullYear() === 2024;
      } else if (dateFilter === 'october') {
        matchesDate = transactionDate.getMonth() === 9 && transactionDate.getFullYear() === 2024;
      } else if (dateFilter === 'november') {
        matchesDate = transactionDate.getMonth() === 10 && transactionDate.getFullYear() === 2024;
      }
    }
    
    return matchesFilter && matchesSearch && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading payment data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Recovery Tools */}
      <PaymentRecoveryTools />

      {/* Payment Health Check */}
      <PaymentHealthCheck />

      {/* Payment Capture History */}
      <PaymentCaptureHistory />

      {/* Payment Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-600">Total Revenue</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(paymentStats.totalRevenue)}
            </div>
            <div className="text-sm text-gray-600">{paymentStats.transactionCount} transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-600">Processing Fees</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(paymentStats.totalFees)}
            </div>
            <div className="text-sm text-gray-600">Est. Stripe fees</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-gray-600">Refunds</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(paymentStats.totalRefunds)}
            </div>
            <div className="text-sm text-gray-600">Total refunded</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-gray-600">Net Income</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(paymentStats.netIncome)}
            </div>
            <div className="text-sm text-green-600">After fees & refunds</div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Payment Transactions</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <StripeSyncButton />
              <PaymentSyncButton />
              <Button onClick={fetchTransactions} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                <SelectItem value="november">November 2024</SelectItem>
                <SelectItem value="october">October 2024</SelectItem>
                <SelectItem value="september">September 2024</SelectItem>
                <SelectItem value="august">August 2024</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="authorized">Authorized</SelectItem>
                <SelectItem value="captured">Captured Payments</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No payment transactions found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {transaction.id?.slice(0, 8) || 'N/A'}...
                      </TableCell>
                      <TableCell>
                        {transaction.booking_id ? (
                          <Button variant="link" className="p-0 h-auto">
                            {transaction.booking_id.slice(0, 8)}...
                          </Button>
                        ) : (
                          <span className="text-gray-500">No booking</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {transaction.booking?.guest_customer_info?.name || 'Unknown Customer'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </TableCell>
                      <TableCell className="capitalize">
                        {transaction.payment_method || 'Unknown'}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell>{formatDate(transaction.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewDetails(transaction)}
                          >
                            View Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
