import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { calculateWorkerEarnings, formatCurrency } from '@/utils/workerEarningsCalculator';
import { useToast } from '@/hooks/use-toast';
import { PayrollWeekNavigation } from '@/components/payroll/PayrollWeekNavigation';

interface WeeklyJob {
  booking_id: string;
  scheduled_date: string;
  customer_name: string;
  services: Array<{
    service_name: string;
    base_price: number;
    quantity: number;
  }>;
  tip_amount: number;
  earnings: number;
}

export function WorkerWeeklyEarnings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  );
  const [weeklyJobs, setWeeklyJobs] = useState<WeeklyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyTotal, setWeeklyTotal] = useState(0);

  useEffect(() => {
    if (user) {
      fetchWeeklyEarnings();
    }
  }, [user, currentWeekStart]);

  const fetchWeeklyEarnings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      
      // Fetch all captured bookings for the week
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          scheduled_date,
          tip_amount,
          guest_customer_info,
          booking_services (
            service_name,
            base_price,
            quantity
          ),
          users!customer_id (
            name
          )
        `)
        .eq('worker_id', user.id)
        .or('status.eq.completed,payment_status.eq.captured')
        .not('status', 'in', '("cancelled","refunded")')
        .gte('scheduled_date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const jobs: WeeklyJob[] = [];
      let total = 0;

      bookings?.forEach(booking => {
        const services = (booking.booking_services || []).map((s: any) => ({
          service_name: s.service_name,
          base_price: s.base_price,
          quantity: s.quantity,
        }));

        const tipAmount = booking.tip_amount || 0;
        const earnings = calculateWorkerEarnings(services, tipAmount);

        jobs.push({
          booking_id: booking.id,
          scheduled_date: booking.scheduled_date,
          customer_name: 
            (booking.guest_customer_info as any)?.name || 
            booking.users?.name || 
            'Customer',
          services,
          tip_amount: tipAmount,
          earnings: earnings.totalEarnings,
        });

        total += earnings.totalEarnings;
      });

      setWeeklyJobs(jobs);
      setWeeklyTotal(total);
    } catch (error) {
      console.error('Error fetching weekly earnings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load weekly earnings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">Weekly Earnings</h1>
        
        {/* Week Navigation */}
        <PayrollWeekNavigation
          currentWeekStart={currentWeekStart}
          onWeekChange={setCurrentWeekStart}
        />
      </div>

      {/* Weekly Total Card */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-800 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-green-800 dark:text-green-200">Total Earnings This Week</p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {weeklyJobs.length} job{weeklyJobs.length !== 1 ? 's' : ''} completed
                </p>
              </div>
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(weeklyTotal)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Jobs This Week</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted-foreground/20 rounded w-1/4"></div>
                    <div className="h-3 bg-muted-foreground/20 rounded w-1/3"></div>
                  </div>
                  <div className="h-6 bg-muted-foreground/20 rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : weeklyJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No completed jobs this week</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weeklyJobs.map(job => (
                <div
                  key={job.booking_id}
                  className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {format(new Date(job.scheduled_date), 'EEEE, MMM d')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {job.customer_name} • Job #{job.booking_id.slice(0, 8)}
                    </div>
                    {job.tip_amount > 0 && (
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Includes {formatCurrency(job.tip_amount)} tip
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">
                      {formatCurrency(job.earnings)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
