import React, { useEffect, useState } from 'react';
import { TrendingUp, Calendar, DollarSign, Users, Star, UserCheck, AlertCircle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/admin/ui/PageHeader';
import { StatCard } from '@/components/admin/ui/StatCard';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { CardSkeleton } from '@/components/admin/ui/Skeletons';
import { Card } from '@/components/ui/card';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

interface DashboardStatsData {
  revenue_this_month: number;
  revenue_last_month: number;
  revenue_delta_pct: number | null;
  jobs_completed_this_month: number;
  jobs_completed_last_month: number;
  jobs_completed_delta_pct: number | null;
  new_customers_this_month: number;
  new_customers_last_month: number;
  new_customers_delta_pct: number | null;
  upcoming_jobs: number;
  unassigned_jobs: number;
  pending_bookings: number;
  active_workers: number;
  total_customers: number;
  avg_rating: number;
  review_count: number;
  generated_at: string;
}

export const DashboardStats = () => {
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_dashboard_stats');
        if (error) throw error;
        if (mounted) {
          setStats(data as DashboardStatsData);
          setError(null);
        }
      } catch (e: any) {
        console.error('Error fetching dashboard stats:', e);
        if (mounted) setError(e?.message || 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [reloadKey]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview of your business at a glance" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Overview of your business at a glance" />
        <Card className="p-6 border-border shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Couldn't load dashboard stats</h3>
              {error && <p className="text-xs text-muted-foreground mt-1">{error}</p>}
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-3 inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Retry
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const deltaProps = (pct: number | null) =>
    pct === null || pct === undefined
      ? {}
      : { delta: Number(Number(pct).toFixed(1)), deltaLabel: 'vs last month' };

  const revenueSeries = [
    { name: 'Last month', value: stats.revenue_last_month },
    { name: 'This month', value: stats.revenue_this_month },
  ];
  const jobsSeries = [
    { name: 'Last month', value: stats.jobs_completed_last_month },
    { name: 'This month', value: stats.jobs_completed_this_month },
  ];

  const attention = [
    stats.unassigned_jobs > 0 && {
      label: 'Unassigned jobs',
      value: `${stats.unassigned_jobs} awaiting assignment`,
      status: 'cancelled',
    },
    stats.pending_bookings > 0 && {
      label: 'Pending bookings',
      value: `${stats.pending_bookings} awaiting confirmation`,
      status: 'pending',
    },
  ].filter(Boolean) as { label: string; value: string; status: string }[];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your business at a glance" />

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Revenue this month"
          value={<span className="tabular-nums">{formatCurrency(stats.revenue_this_month)}</span>}
          icon={DollarSign}
          {...deltaProps(stats.revenue_delta_pct)}
        />
        <StatCard
          label="Jobs completed"
          value={<span className="tabular-nums">{stats.jobs_completed_this_month}</span>}
          icon={TrendingUp}
          {...(stats.jobs_completed_delta_pct === null || stats.jobs_completed_delta_pct === undefined
            ? { deltaLabel: 'this month' } as any
            : { delta: Number(stats.jobs_completed_delta_pct.toFixed(1)), deltaLabel: 'this month' })}
        />
        <StatCard
          label="Upcoming jobs"
          value={<span className="tabular-nums">{stats.upcoming_jobs}</span>}
          icon={Calendar}
        />
        <StatCard
          label="Active workers"
          value={<span className="tabular-nums">{stats.active_workers}</span>}
          icon={UserCheck}
        />
        <StatCard
          label="New customers"
          value={<span className="tabular-nums">{stats.new_customers_this_month}</span>}
          icon={Users}
          {...(stats.new_customers_delta_pct === null || stats.new_customers_delta_pct === undefined
            ? { deltaLabel: 'this month' } as any
            : { delta: Number(stats.new_customers_delta_pct.toFixed(1)), deltaLabel: 'this month' })}
        />
        <StatCard
          label="Average rating"
          value={
            <span className="tabular-nums">
              {stats.review_count > 0 ? (
                <>
                  {Number(stats.avg_rating).toFixed(1)}
                  <span className="text-sm text-muted-foreground font-normal ml-2">
                    · {stats.review_count} {stats.review_count === 1 ? 'review' : 'reviews'}
                  </span>
                </>
              ) : (
                <span className="text-base text-muted-foreground font-normal">No reviews yet</span>
              )}
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
              {formatCurrency(stats.revenue_this_month)}
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
              <h3 className="text-sm font-semibold text-foreground">Jobs completed</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This month vs last month</p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {stats.jobs_completed_this_month} jobs
            </span>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jobsSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
