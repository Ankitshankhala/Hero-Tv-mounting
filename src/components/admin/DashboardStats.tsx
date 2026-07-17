import React from 'react';
import { TrendingUp, Calendar, DollarSign, Users, Star, Clock, UserCheck, AlertCircle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from 'recharts';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
import { PageHeader } from '@/components/admin/ui/PageHeader';
import { StatCard } from '@/components/admin/ui/StatCard';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { CardSkeleton } from '@/components/admin/ui/Skeletons';
import { Card } from '@/components/ui/card';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

export const DashboardStats = () => {
  const { metrics, loading } = useAdminMetrics();

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview of your business at a glance" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // Reconstruct previous-period values from current + growth% (no new queries)
  const previous = (current: number, growth: number) =>
    growth === 0 ? current : Math.max(0, Math.round(current / (1 + growth / 100)));

  const revenueLast = previous(metrics.revenueThisMonth, metrics.revenueGrowth);
  const bookingsLast = previous(metrics.bookingsThisMonth, metrics.bookingsGrowth);

  const revenueSeries = [
    { name: 'Last month', value: revenueLast },
    { name: 'This month', value: metrics.revenueThisMonth },
  ];
  const bookingsSeries = [
    { name: 'Last month', value: bookingsLast },
    { name: 'This month', value: metrics.bookingsThisMonth },
  ];

  const attention = [
    metrics.pendingBookings > 0 && {
      label: 'Pending bookings',
      value: `${metrics.pendingBookings} awaiting confirmation`,
      status: 'pending',
    },
    metrics.activeWorkers === 0 && {
      label: 'No active workers',
      value: 'No workers available for assignment',
      status: 'cancelled',
    },
    metrics.averageRating > 0 && metrics.averageRating < 4 && {
      label: 'Rating below target',
      value: `Average ${metrics.averageRating.toFixed(1)} across ${metrics.totalReviews} reviews`,
      status: 'progress',
    },
  ].filter(Boolean) as { label: string; value: string; status: string }[];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your business at a glance" />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue this month"
          value={<span className="tabular-nums">{formatCurrency(metrics.revenueThisMonth)}</span>}
          delta={Number(metrics.revenueGrowth.toFixed(1))}
          deltaLabel="vs last month"
          icon={DollarSign}
        />
        <StatCard
          label="Authorized bookings"
          value={<span className="tabular-nums">{metrics.bookingsThisMonth}</span>}
          delta={Number(metrics.bookingsGrowth.toFixed(1))}
          deltaLabel="vs last month"
          icon={Calendar}
        />
        <StatCard
          label="Active customers"
          value={<span className="tabular-nums">{metrics.activeCustomers}</span>}
          delta={Number(metrics.customersGrowth.toFixed(1))}
          deltaLabel="vs last month"
          icon={Users}
        />
        <StatCard
          label="Jobs completed"
          value={<span className="tabular-nums">{metrics.completedJobs}</span>}
          delta={Number(metrics.jobsGrowth.toFixed(1))}
          deltaLabel="vs last month"
          icon={TrendingUp}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <StatCard
          label="Pending bookings"
          value={<span className="tabular-nums">{metrics.pendingBookings}</span>}
          icon={Clock}
        />
        <StatCard
          label="Active workers"
          value={<span className="tabular-nums">{metrics.activeWorkers}</span>}
          icon={UserCheck}
        />
        <StatCard
          label="Average rating"
          value={
            <span className="tabular-nums">
              {metrics.averageRating > 0 ? metrics.averageRating.toFixed(1) : '—'}
              <span className="text-sm text-muted-foreground font-normal ml-2">
                {metrics.totalReviews} reviews
              </span>
            </span>
          }
          icon={Star}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card className="p-5 border-border shadow-sm">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Revenue trend</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This month vs last month</p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(metrics.revenueThisMonth)}
            </span>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 border-border shadow-sm">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Bookings</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This month vs last month</p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {metrics.bookingsThisMonth} bookings
            </span>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={80} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Needs attention */}
      {attention.length > 0 && (
        <Card className="p-5 border-border shadow-sm mt-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Needs attention</h3>
          </div>
          <ul className="divide-y divide-border">
            {attention.map((item, i) => (
              <li key={i} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.value}</p>
                </div>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};
