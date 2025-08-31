import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  CheckCircle, 
  Clock,
  CreditCard
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';

interface EarningsData {
  totalEarnings: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  yearEarnings: number;
  completedJobs: number;
  pendingPayments: number;
  recentPayments: Array<{
    id: string;
    amount: number;
    date: string;
    service: string;
    customer: string;
    status: string;
  }>;
}

export function WorkerEarnings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData>({
    totalEarnings: 0,
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    yearEarnings: 0,
    completedJobs: 0,
    pendingPayments: 0,
    recentPayments: []
  });

  useEffect(() => {
    if (user) {
      fetchEarnings();
    }
  }, [user]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);
      const yearStart = startOfYear(now);

      // Fetch bookings with payment data
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          pending_payment_amount,
          payment_status,
          status,
          created_at,
          booking_services (
            service_name
          ),
          users!customer_id (
            email
          )
        `)
        .eq('worker_id', user?.id)
        .in('payment_status', ['captured', 'pending'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      let totalEarnings = 0;
      let todayEarnings = 0;
      let weekEarnings = 0;
      let monthEarnings = 0;
      let yearEarnings = 0;
      let completedJobs = 0;
      let pendingPayments = 0;
      const recentPayments: EarningsData['recentPayments'] = [];

      bookings?.forEach((booking) => {
        const bookingDate = new Date(booking.created_at || '');
        const amount = booking.pending_payment_amount || 0;

        if (booking.payment_status === 'captured') {
          totalEarnings += amount;
          
          if (bookingDate >= todayStart) {
            todayEarnings += amount;
          }
          if (bookingDate >= weekStart) {
            weekEarnings += amount;
          }
          if (bookingDate >= monthStart) {
            monthEarnings += amount;
          }
          if (bookingDate >= yearStart) {
            yearEarnings += amount;
          }
          
          if (booking.status === 'completed') {
            completedJobs++;
          }

          // Add to recent payments
          if (recentPayments.length < 10) {
            recentPayments.push({
              id: booking.id,
              amount,
              date: booking.created_at,
              service: (booking.booking_services as any)?.[0]?.service_name || 'Service',
              customer: booking.users?.email || 'Customer',
              status: booking.payment_status
            });
          }
        } else if (booking.payment_status === 'pending') {
          pendingPayments++;
        }
      });

      setEarnings({
        totalEarnings,
        todayEarnings,
        weekEarnings,
        monthEarnings,
        yearEarnings,
        completedJobs,
        pendingPayments,
        recentPayments
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const earningsCards = [
    {
      title: "Today's Earnings",
      value: formatCurrency(earnings.todayEarnings),
      icon: DollarSign,
      color: "text-action-success"
    },
    {
      title: "This Week",
      value: formatCurrency(earnings.weekEarnings),
      icon: TrendingUp,
      color: "text-action-info"
    },
    {
      title: "This Month", 
      value: formatCurrency(earnings.monthEarnings),
      icon: Calendar,
      color: "text-action-warning"
    },
    {
      title: "Total Earned",
      value: formatCurrency(earnings.totalEarnings),
      icon: CheckCircle,
      color: "text-action-success"
    }
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-20"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Earnings Dashboard</h1>
        {earnings.pendingPayments > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {earnings.pendingPayments} Pending Payment{earnings.pendingPayments !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Earnings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {earningsCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Payments */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <CreditCard className="h-5 w-5" />
            Recent Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.recentPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recent payments found
            </div>
          ) : (
            <div className="space-y-3">
              {earnings.recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{payment.service}</div>
                    <div className="text-sm text-muted-foreground">
                      {payment.customer} • {format(new Date(payment.date), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-foreground">{formatCurrency(payment.amount)}</div>
                    <Badge variant={payment.status === 'captured' ? 'default' : 'secondary'} className="text-xs">
                      {payment.status === 'captured' ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}