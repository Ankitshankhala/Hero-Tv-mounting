import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, DollarSign, Clock } from 'lucide-react';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';
export const QuickStatsRibbon = () => {
  const {
    metrics,
    loading
  } = useAdminMetrics();
  if (loading) {
    return <Card className="p-4 mb-6 bg-background/50 backdrop-blur-sm border-border">
        <div className="flex justify-between items-center">
          <div className="flex space-x-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded mb-1 w-20"></div>
                <div className="h-6 bg-muted rounded w-16"></div>
              </div>)}
          </div>
        </div>
      </Card>;
  }
  const stats = [{
    label: "Today's Revenue",
    value: `$${metrics.totalRevenue.toLocaleString()}`,
    icon: DollarSign,
    color: 'text-green-600'
  }, {
    label: 'Pending Bookings',
    value: metrics.pendingBookings.toString(),
    icon: Clock,
    color: metrics.pendingBookings > 0 ? 'text-orange-600' : 'text-green-600'
  }, {
    label: 'Active Workers',
    value: metrics.activeWorkers.toString(),
    icon: Users,
    color: metrics.activeWorkers > 0 ? 'text-blue-600' : 'text-red-600'
  }, {
    label: 'This Month',
    value: `${metrics.bookingsThisMonth} bookings`,
    icon: Calendar,
    color: 'text-purple-600'
  }];
  return;
};