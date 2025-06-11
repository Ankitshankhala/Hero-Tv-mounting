
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminMetrics {
  totalRevenue: number;
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
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalRevenue: 0,
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
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      console.log('Fetching admin metrics...');

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Fetch bookings data
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*');

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      // Fetch users data
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      // Fetch reviews data
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('rating');

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
        throw reviewsError;
      }

      // Calculate metrics
      const completedBookings = bookings?.filter(b => b.status === 'completed') || [];
      const thisMonthBookings = bookings?.filter(b => 
        new Date(b.created_at) >= startOfMonth
      ) || [];
      const lastMonthBookings = bookings?.filter(b => 
        new Date(b.created_at) >= startOfLastMonth && 
        new Date(b.created_at) <= endOfLastMonth
      ) || [];

      const thisMonthCompleted = completedBookings.filter(b => 
        new Date(b.created_at) >= startOfMonth
      );
      const lastMonthCompleted = completedBookings.filter(b => 
        new Date(b.created_at) >= startOfLastMonth && 
        new Date(b.created_at) <= endOfLastMonth
      );

      const totalRevenue = completedBookings.reduce((sum, booking) => 
        sum + (Number(booking.total_price) || 0), 0
      );

      const thisMonthRevenue = thisMonthCompleted.reduce((sum, booking) => 
        sum + (Number(booking.total_price) || 0), 0
      );
      const lastMonthRevenue = lastMonthCompleted.reduce((sum, booking) => 
        sum + (Number(booking.total_price) || 0), 0
      );

      const customers = users?.filter(u => u.role === 'customer') || [];
      const workers = users?.filter(u => u.role === 'worker' && u.is_active) || [];
      
      const thisMonthCustomers = customers.filter(c => 
        new Date(c.created_at) >= startOfMonth
      );
      const lastMonthCustomers = customers.filter(c => 
        new Date(c.created_at) >= startOfLastMonth && 
        new Date(c.created_at) <= endOfLastMonth
      );

      const pendingBookings = bookings?.filter(b => b.status === 'pending') || [];

      // Calculate growth percentages
      const revenueGrowth = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;
      
      const bookingsGrowth = lastMonthBookings.length > 0 
        ? ((thisMonthBookings.length - lastMonthBookings.length) / lastMonthBookings.length) * 100 
        : 0;

      const customersGrowth = lastMonthCustomers.length > 0 
        ? ((thisMonthCustomers.length - lastMonthCustomers.length) / lastMonthCustomers.length) * 100 
        : 0;

      const jobsGrowth = lastMonthCompleted.length > 0 
        ? ((thisMonthCompleted.length - lastMonthCompleted.length) / lastMonthCompleted.length) * 100 
        : 0;

      // Calculate average rating
      const validRatings = reviews?.filter(r => r.rating && r.rating > 0) || [];
      const averageRating = validRatings.length > 0 
        ? validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length 
        : 0;

      setMetrics({
        totalRevenue,
        revenueGrowth,
        bookingsThisMonth: thisMonthBookings.length,
        bookingsGrowth,
        activeCustomers: customers.length,
        customersGrowth,
        completedJobs: completedBookings.length,
        jobsGrowth,
        pendingBookings: pendingBookings.length,
        activeWorkers: workers.length,
        averageRating,
        totalReviews: validRatings.length,
      });

      console.log('Admin metrics calculated successfully');
    } catch (error) {
      console.error('Error fetching admin metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return { metrics, loading, refetch: fetchMetrics };
};
