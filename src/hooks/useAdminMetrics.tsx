
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
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Get previous month dates for comparison
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Get all bookings
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('*');

        if (bookingsError) throw bookingsError;

        // Get transactions that represent actual revenue
        const { data: transactions, error: transactionsError } = await supabase
          .from('transactions')
          .select(`
            amount, 
            status, 
            created_at,
            transaction_type
          `)
          .in('status', ['captured', 'authorized'])
          .in('transaction_type', ['capture', 'charge']);

        if (transactionsError) throw transactionsError;

        // Get users data
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*');

        if (usersError) throw usersError;

        // Reviews are no longer tracked in database
        const reviews: any[] = [];

        // Calculate current metrics
        const totalBookings = bookings?.length || 0;
        const totalRevenue = transactions?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
        const completedBookings = bookings?.filter(booking => booking.status === 'completed').length || 0;
        const pendingBookings = bookings?.filter(booking => booking.status === 'pending').length || 0;
        const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

        // Current month data
        const bookingsThisMonth = bookings?.filter(booking => {
          const bookingDate = new Date(booking.created_at);
          return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
        }).length || 0;

        const revenueThisMonth = transactions?.filter(transaction => {
          const transactionDate = new Date(transaction.created_at);
          return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
        }).reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;

        const customersThisMonth = users?.filter(user => {
          const userDate = new Date(user.created_at);
          return user.role === 'customer' && user.is_active && 
                 userDate.getMonth() === currentMonth && userDate.getFullYear() === currentYear;
        }).length || 0;

        const jobsThisMonth = bookings?.filter(booking => {
          const bookingDate = new Date(booking.created_at);
          return booking.status === 'completed' && 
                 bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
        }).length || 0;

        // Previous month data for growth calculation
        const bookingsLastMonth = bookings?.filter(booking => {
          const bookingDate = new Date(booking.created_at);
          return bookingDate.getMonth() === previousMonth && bookingDate.getFullYear() === previousYear;
        }).length || 0;

        const revenueLastMonth = transactions?.filter(transaction => {
          const transactionDate = new Date(transaction.created_at);
          return transactionDate.getMonth() === previousMonth && transactionDate.getFullYear() === previousYear;
        }).reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;

        const customersLastMonth = users?.filter(user => {
          const userDate = new Date(user.created_at);
          return user.role === 'customer' && user.is_active && 
                 userDate.getMonth() === previousMonth && userDate.getFullYear() === previousYear;
        }).length || 0;

        const jobsLastMonth = bookings?.filter(booking => {
          const bookingDate = new Date(booking.created_at);
          return booking.status === 'completed' && 
                 bookingDate.getMonth() === previousMonth && bookingDate.getFullYear() === previousYear;
        }).length || 0;

        // Calculate growth percentages
        const calculateGrowth = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return ((current - previous) / previous) * 100;
        };

        const revenueGrowth = calculateGrowth(revenueThisMonth, revenueLastMonth);
        const bookingsGrowth = calculateGrowth(bookingsThisMonth, bookingsLastMonth);
        const customersGrowth = calculateGrowth(customersThisMonth, customersLastMonth);
        const jobsGrowth = calculateGrowth(jobsThisMonth, jobsLastMonth);

        // Active users and workers
        const activeCustomers = users?.filter(user => user.role === 'customer' && user.is_active).length || 0;
        const activeWorkers = users?.filter(user => user.role === 'worker' && user.is_active).length || 0;

        // Reviews metrics
        const totalReviews = reviews?.length || 0;
        const averageRating = totalReviews > 0 
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
          : 0;

        setMetrics({
          totalBookings,
          totalRevenue,
          avgBookingValue,
          completedBookings,
          revenueGrowth,
          bookingsThisMonth,
          bookingsGrowth,
          activeCustomers,
          customersGrowth,
          completedJobs: jobsThisMonth,
          jobsGrowth,
          pendingBookings,
          activeWorkers,
          averageRating,
          totalReviews
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
