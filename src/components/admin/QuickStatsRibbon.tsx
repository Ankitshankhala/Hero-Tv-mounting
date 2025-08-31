import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, DollarSign, Clock } from 'lucide-react';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

export const QuickStatsRibbon = () => {
  const { metrics, loading } = useAdminMetrics();

  if (loading) {
    return (
      <Card className="p-4 mb-6 bg-background/50 backdrop-blur-sm border-border">
        <div className="flex justify-between items-center">
          <div className="flex space-x-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded mb-1 w-20"></div>
                <div className="h-6 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const stats = [
    {
      label: "Today's Revenue",
      value: `$${metrics.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      label: 'Pending Bookings',
      value: metrics.pendingBookings.toString(),
      icon: Clock,
      color: metrics.pendingBookings > 0 ? 'text-orange-600' : 'text-green-600'
    },
    {
      label: 'Active Workers',
      value: metrics.activeWorkers.toString(),
      icon: Users,
      color: metrics.activeWorkers > 0 ? 'text-blue-600' : 'text-red-600'
    },
    {
      label: 'This Month',
      value: `${metrics.bookingsThisMonth} bookings`,
      icon: Calendar,
      color: 'text-purple-600'
    }
  ];

  return (
    <Card className="p-4 mb-6 bg-background/50 backdrop-blur-sm border-border">
      <div className="flex justify-between items-center">
        <div className="flex space-x-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="flex items-center space-x-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-sm font-semibold">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center space-x-2">
          {metrics.pendingBookings > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {metrics.pendingBookings} pending
            </Badge>
          )}
          {metrics.activeWorkers === 0 && (
            <Badge variant="destructive">
              No workers active
            </Badge>
          )}
          {metrics.averageRating > 4.5 && (
            <Badge variant="default" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
              ⭐ {metrics.averageRating.toFixed(1)}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};