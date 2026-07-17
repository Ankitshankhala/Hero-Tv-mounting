import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, DollarSign, RefreshCw, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PaymentDetailsModal from './PaymentDetailsModal';
import { PaymentRecoveryTools } from './PaymentRecoveryTools';
import { PaymentSyncButton } from './PaymentSyncButton';
import { StripeSyncButton } from './StripeSyncButton';
import { PaymentHealthCheck } from './PaymentHealthCheck';
import { PaymentCaptureHistory } from './PaymentCaptureHistory';
import { StripeModeToggle } from './StripeModeToggle';
import { PaymentFirstToggle } from './PaymentFirstToggle';
import { PageHeader } from '@/components/admin/ui/PageHeader';
import { Toolbar } from '@/components/admin/ui/Toolbar';
import { DataTable, type Column } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { StatCard } from '@/components/admin/ui/StatCard';
import { EmptyState } from '@/components/admin/ui/EmptyState';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats>({
    totalRevenue: 0, totalFees: 0, totalRefunds: 0, netIncome: 0, transactionCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
    const channel = supabase
      .channel('transactions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchTransactions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data: transactionsData, error } = await supabase
        .from('transactions')
        .select(`
          id, booking_id, amount, status, payment_method, payment_intent_id,
          created_at, currency,
          booking:bookings(guest_customer_info)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processed = (transactionsData || []).map((t) => ({
        ...t,
        booking: Array.isArray(t.booking) ? t.booking[0] : t.booking,
      }));
      setTransactions(processed);
      calculateStats(processed);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({ title: 'Error', description: 'Failed to load payment transactions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (txs: Transaction[]) => {
    const stats = txs.reduce(
      (acc, t) => {
        const amount = Number(t.amount) || 0;
        if (t.status === 'completed' || t.status === 'success') {
          acc.totalRevenue += amount;
          acc.totalFees += amount * 0.029 + 0.3;
        } else if (t.status === 'refunded') {
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

  const handleViewDetails = (payment: any) => {
    setSelectedPayment(payment);
    setIsDetailsModalOpen(true);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const filtered = transactions.filter((t) => {
    const matchesFilter = filterType === 'all' || t.status === filterType;
    const name = t.booking?.guest_customer_info?.name || '';
    const email = t.booking?.guest_customer_info?.email || '';
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      name.toLowerCase().includes(s) ||
      email.toLowerCase().includes(s) ||
      t.id.toLowerCase().includes(s) ||
      (t.booking_id && t.booking_id.toLowerCase().includes(s));

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const td = new Date(t.created_at);
      if (dateFilter === 'august') matchesDate = td.getMonth() === 7 && td.getFullYear() === 2024;
      else if (dateFilter === 'september') matchesDate = td.getMonth() === 8 && td.getFullYear() === 2024;
      else if (dateFilter === 'october') matchesDate = td.getMonth() === 9 && td.getFullYear() === 2024;
      else if (dateFilter === 'november') matchesDate = td.getMonth() === 10 && td.getFullYear() === 2024;
    }
    return matchesFilter && matchesSearch && matchesDate;
  });

  const columns: Column<Transaction>[] = [
    {
      key: 'id',
      header: 'Transaction',
      accessor: (t) => (
        <span className="font-mono text-xs text-muted-foreground">
          {t.id?.slice(0, 8) || 'N/A'}…
        </span>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      accessor: (t) => t.booking_id ? (
        <span className="font-mono text-xs">{t.booking_id.slice(0, 8)}…</span>
      ) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      accessor: (t) => t.booking?.guest_customer_info?.name || <span className="text-muted-foreground">Unknown</span>,
      sortable: true,
      sortValue: (t) => (t.booking?.guest_customer_info?.name || '').toLowerCase(),
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (t) => formatCurrency(t.amount, t.currency),
      numeric: true,
      sortable: true,
      sortValue: (t) => Number(t.amount) || 0,
    },
    {
      key: 'method',
      header: 'Method',
      accessor: (t) => <span className="capitalize text-sm">{t.payment_method || 'Unknown'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.created_at)}</span>,
      sortable: true,
      sortValue: (t) => new Date(t.created_at).getTime(),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      accessor: (t) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewDetails(t)}>View details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Payment transactions, fees, and refunds"
        actions={
          <div className="flex items-center gap-2">
            <StripeSyncButton />
            <PaymentSyncButton />
            <Button onClick={fetchTransactions} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />Refresh
            </Button>
          </div>
        }
      />

      <StripeModeToggle />
      <div className="mt-4"><PaymentFirstToggle /></div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <StatCard
          label="Total Revenue"
          value={<span className="tabular-nums">{formatCurrency(paymentStats.totalRevenue)}</span>}
          deltaLabel={`${paymentStats.transactionCount} transactions`}
          icon={DollarSign}
        />
        <StatCard
          label="Processing Fees"
          value={<span className="tabular-nums">{formatCurrency(paymentStats.totalFees)}</span>}
          icon={CreditCard}
        />
        <StatCard
          label="Refunds"
          value={<span className="tabular-nums">{formatCurrency(paymentStats.totalRefunds)}</span>}
          icon={RefreshCw}
        />
        <StatCard
          label="Net Income"
          value={<span className="tabular-nums">{formatCurrency(paymentStats.netIncome)}</span>}
          icon={DollarSign}
        />
      </div>

      {/* Transactions table */}
      <div className="mt-6">
        <Toolbar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search transactions..."
          filters={
            <>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  <SelectItem value="november">November 2024</SelectItem>
                  <SelectItem value="october">October 2024</SelectItem>
                  <SelectItem value="september">September 2024</SelectItem>
                  <SelectItem value="august">August 2024</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="authorized">Authorized</SelectItem>
                  <SelectItem value="captured">Captured</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        />

        <Card className="p-4 border-border shadow-sm">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(t) => t.id}
            loading={loading}
            pageSize={20}
            empty={<EmptyState icon={CreditCard} title="No transactions" description="No payment transactions match your filters." />}
          />
        </Card>
      </div>

      <div className="mt-6"><PaymentCaptureHistory /></div>
      <div className="mt-6"><PaymentRecoveryTools /></div>
      <div className="mt-6"><PaymentHealthCheck /></div>

      <PaymentDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        payment={selectedPayment}
      />
    </>
  );
};
