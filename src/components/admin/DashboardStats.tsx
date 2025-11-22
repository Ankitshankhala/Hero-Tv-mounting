import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar, DollarSign, Users, Star, Clock, UserCheck } from 'lucide-react';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
import { Badge } from '@/components/ui/badge';
import { StripeConfigStatus } from './StripeConfigStatus';
import { BookingSmokeTest } from './BookingSmokeTest';
import { StorageCacheOptimizer } from './StorageCacheOptimizer';
import { DataRepairButton } from './DataRepairButton';
import { BookingIntegrityMonitor } from './BookingIntegrityMonitor';
import { PricingIntegrityMonitor } from './PricingIntegrityMonitor';
import { PaymentPerformanceMonitor } from './PaymentPerformanceMonitor';
export const DashboardStats = () => {
  const {
    metrics,
    loading
  } = useAdminMetrics();
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };
  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  };
  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };
  if (loading) {
    return <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Card key={i} className="animate-pulse bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-700 rounded mb-2"></div>
                <div className="h-8 bg-slate-700 rounded mb-1"></div>
                <div className="h-3 bg-slate-700 rounded"></div>
              </CardContent>
            </Card>)}
        </div>
      </div>;
  }
  const stats = [{
    title: 'Total Revenue',
    value: formatCurrency(metrics.totalRevenue),
    description: `${formatGrowth(metrics.revenueGrowth)} from last month`,
    icon: DollarSign,
    color: 'text-green-600',
    growth: metrics.revenueGrowth
  }, {
    title: 'Bookings This Month',
    value: metrics.bookingsThisMonth.toString(),
    description: `${formatGrowth(metrics.bookingsGrowth)} from last month`,
    icon: Calendar,
    color: 'text-blue-600',
    growth: metrics.bookingsGrowth
  }, {
    title: 'Active Customers',
    value: metrics.activeCustomers.toString(),
    description: `${formatGrowth(metrics.customersGrowth)} from last month`,
    icon: Users,
    color: 'text-purple-600',
    growth: metrics.customersGrowth
  }, {
    title: 'Jobs Completed',
    value: metrics.completedJobs.toString(),
    description: `${formatGrowth(metrics.jobsGrowth)} from last month`,
    icon: TrendingUp,
    color: 'text-orange-600',
    growth: metrics.jobsGrowth
  }];
  const additionalStats = [{
    title: 'Pending Bookings',
    value: metrics.pendingBookings.toString(),
    description: 'Awaiting confirmation',
    icon: Clock,
    color: 'text-yellow-600'
  }, {
    title: 'Active Workers',
    value: metrics.activeWorkers.toString(),
    description: 'Available for jobs',
    icon: UserCheck,
    color: 'text-indigo-600'
  }, {
    title: 'Average Rating',
    value: metrics.averageRating > 0 ? metrics.averageRating.toFixed(1) : 'N/A',
    description: `${metrics.totalReviews} reviews`,
    icon: Star,
    color: 'text-yellow-500'
  }];
  return <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
        const Icon = stat.icon;
        return <Card key={index} className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <p className={`text-xs mt-1 ${getGrowthColor(stat.growth)}`}>
                  {stat.description}
                </p>
              </CardContent>
            </Card>;
      })}
      </div>

      {/* Additional Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {additionalStats.map((stat, index) => {
        const Icon = stat.icon;
        return <Card key={index} className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <p className="text-xs text-slate-400 mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>;
      })}
      </div>

      {/* System Configuration and Testing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">System Tools</CardTitle>
            <CardDescription className="text-slate-400">Data repair and testing utilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DataRepairButton />
          </CardContent>
        </Card>
      </div>
      
      <PaymentPerformanceMonitor />
      
      <PricingIntegrityMonitor />
      
      <BookingIntegrityMonitor />
      
      <BookingSmokeTest />

      {/* Quick Status Overview */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">System Status Overview</CardTitle>
          <CardDescription className="text-slate-400">Current system health and activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant={metrics.pendingBookings > 0 ? "destructive" : "default"} className="bg-blue-600/20 text-blue-400 border-blue-500/30">
              {metrics.pendingBookings} Pending Bookings
            </Badge>
            <Badge variant={metrics.activeWorkers > 0 ? "default" : "secondary"} className="bg-green-600/20 text-green-400 border-green-500/30">
              {metrics.activeWorkers} Active Workers
            </Badge>
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              {metrics.totalReviews} Total Reviews
            </Badge>
            {metrics.averageRating > 4.5 && <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                ⭐ Excellent Rating
              </Badge>}
          </div>
        </CardContent>
      </Card>
    </div>;
};