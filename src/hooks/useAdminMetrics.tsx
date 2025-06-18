
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
        // Get all bookings
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('*');

        if (bookingsError) throw bookingsError;

        // Get all transactions for revenue calculation
        const { data: transactions, error: transactionsError } = await supabase
          .from('transactions')
          .select('amount, status')
          .eq('status', 'completed');

        if (transactionsError) throw transactionsError;

        // Get users data
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*');

        if (usersError) throw usersError;

        // Get reviews data
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('rating');

        if (reviewsError) throw reviewsError;

        // Calculate metrics
        const totalBookings = bookings?.length || 0;
        const totalRevenue = transactions?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
        const completedBookings = bookings?.filter(booking => booking.status === 'completed').length || 0;
        const pendingBookings = bookings?.filter(booking => booking.status === 'pending').length || 0;
        const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

        // Get current month data
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        const bookingsThisMonth = bookings?.filter(booking => {
          const bookingDate = new Date(booking.created_at);
          return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
        }).length || 0;

        // Active users and workers
        const activeCustomers = users?.filter(user => user.role === 'customer' && user.is_active).length || 0;
        const activeWorkers = users?.filter(user => user.role === 'worker' && user.is_active).length || 0;

        // Reviews metrics
        const totalReviews = reviews?.length || 0;
        const averageRating = totalReviews > 0 
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
          : 0;

        // Mock growth calculations (would need historical data for real calculations)
        const revenueGrowth = 15.2;
        const bookingsGrowth = 8.5;
        const customersGrowth = 12.3;
        const jobsGrowth = 6.7;

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
          completedJobs: completedBookings,
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
  }, []);

  return { metrics, loading };
};
