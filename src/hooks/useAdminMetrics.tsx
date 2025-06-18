
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MetricsData {
  totalBookings: number;
  totalRevenue: number;
  avgBookingValue: number;
  completedBookings: number;
}

export const useAdminMetrics = () => {
  const [metrics, setMetrics] = useState<MetricsData>({
    totalBookings: 0,
    totalRevenue: 0,
    avgBookingValue: 0,
    completedBookings: 0
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

        // Calculate metrics
        const totalBookings = bookings?.length || 0;
        const totalRevenue = transactions?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
        const completedBookings = bookings?.filter(booking => booking.status === 'completed').length || 0;
        const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

        setMetrics({
          totalBookings,
          totalRevenue,
          avgBookingValue,
          completedBookings
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
