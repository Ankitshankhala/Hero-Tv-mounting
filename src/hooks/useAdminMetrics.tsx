
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MetricsData {
  totalBookings: number;
  totalRevenue: number;
  avgBookingValue: number;
  completedBookings: number;
  revenueGrowth: number;
  bookingsThisMonth: number;
  bookingsGrowth: number;
  activeCustomers: number;
  customersGrowth: number;
  completedJobs: number;
  jobsGrowth: number;
  pendingBookings: number;
  activeWorkers: number;
  averageRating: number;
  totalReviews: number;
}

export const useAdminMetrics = () => {
  const [metrics, setMetrics] = useState<MetricsData>({
    totalBookings: 0,
    totalRevenue: 0,
    avgBookingValue: 0,
    completedBookings: 0,
    revenueGrowth: 0,
    bookingsThisMonth: 0,
    bookingsGrowth: 0,
    activeCustomers: 0,
    customersGrowth: 0,
    completedJobs: 0,
    jobsGrowth: 0,
    pendingBookings: 0,
    activeWorkers: 0,
    averageRating: 0,
    totalReviews: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Use optimized database function for instant metrics
        const { data, error } = await supabase.rpc('get_admin_dashboard_metrics');

        if (error) throw error;

        if (!data) {
          console.log('No metrics data returned');
          return;
        }

        // Cast to proper type
        const metricsData = data as any;

        // Calculate growth percentages
        const calculateGrowth = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return ((current - previous) / previous) * 100;
        };

        const revenueGrowth = calculateGrowth(
          Number(metricsData.revenueThisMonth || 0), 
          Number(metricsData.revenueLastMonth || 0)
        );
        const bookingsGrowth = calculateGrowth(
          Number(metricsData.bookingsThisMonth || 0), 
          Number(metricsData.bookingsLastMonth || 0)
        );
        const customersGrowth = calculateGrowth(
          Number(metricsData.customersThisMonth || 0), 
          Number(metricsData.customersLastMonth || 0)
        );
        const jobsGrowth = calculateGrowth(
          Number(metricsData.jobsThisMonth || 0), 
          Number(metricsData.jobsLastMonth || 0)
        );

        setMetrics({
          totalBookings: Number(metricsData.totalBookings || 0),
          totalRevenue: Number(metricsData.totalRevenue || 0),
          avgBookingValue: Number(metricsData.avgBookingValue || 0),
          completedBookings: Number(metricsData.completedBookings || 0),
          revenueGrowth,
          bookingsThisMonth: Number(metricsData.bookingsThisMonth || 0),
          bookingsGrowth,
          activeCustomers: Number(metricsData.activeCustomers || 0),
          customersGrowth,
          completedJobs: Number(metricsData.jobsThisMonth || 0),
          jobsGrowth,
          pendingBookings: Number(metricsData.pendingBookings || 0),
          activeWorkers: Number(metricsData.activeWorkers || 0),
          averageRating: Number(metricsData.averageRating || 0),
          totalReviews: Number(metricsData.totalReviews || 0)
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Set up real-time subscription for metrics updates
    const channel = supabase
      .channel('metrics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          console.log('Bookings changed, refreshing metrics');
          fetchMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          console.log('Transactions changed, refreshing metrics');
          fetchMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        () => {
          console.log('Users changed, refreshing metrics');
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { metrics, loading };
};
