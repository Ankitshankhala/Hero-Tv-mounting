import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Download, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { calculateWorkerEarnings, formatCurrency } from '@/utils/workerEarningsCalculator';
import { useToast } from '@/hooks/use-toast';

interface WorkerPayment {
  worker_id: string;
  worker_name: string;
  worker_email: string;
  jobs_completed: number;
  total_owed: number;
}

export function WorkerWeeklyPayments() {
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [workerPayments, setWorkerPayments] = useState<WorkerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPayroll, setTotalPayroll] = useState(0);

  useEffect(() => {
    fetchWorkerPayments();
  }, [currentWeekStart]);

  const fetchWorkerPayments = async () => {
    try {
      setLoading(true);
      
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      
      // Fetch all workers
      const { data: workers, error: workersError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'worker');

      if (workersError) throw workersError;

      const payments: WorkerPayment[] = [];
      let payrollTotal = 0;

      // For each worker, fetch their bookings for the week
      for (const worker of workers || []) {
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            tip_amount,
            booking_services (
              service_name,
              base_price,
              quantity
            )
          `)
          .eq('worker_id', worker.id)
          .eq('payment_status', 'captured')
          .gte('scheduled_date', format(currentWeekStart, 'yyyy-MM-dd'))
          .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'));

        if (bookingsError) {
          console.error(`Error fetching bookings for worker ${worker.id}:`, bookingsError);
          continue;
        }

        let workerTotal = 0;
        const jobsCount = bookings?.length || 0;

        bookings?.forEach(booking => {
          const services = (booking.booking_services || []).map((s: any) => ({
            service_name: s.service_name,
            base_price: s.base_price,
            quantity: s.quantity,
          }));

          const tipAmount = booking.tip_amount || 0;
          const earnings = calculateWorkerEarnings(services, tipAmount);
          workerTotal += earnings.totalEarnings;
        });

        if (jobsCount > 0) {
          payments.push({
            worker_id: worker.id,
            worker_name: worker.name || 'Unknown',
            worker_email: worker.email || '',
            jobs_completed: jobsCount,
            total_owed: workerTotal,
          });
          payrollTotal += workerTotal;
        }
      }

      // Sort by total owed (descending)
      payments.sort((a, b) => b.total_owed - a.total_owed);

      setWorkerPayments(payments);
      setTotalPayroll(payrollTotal);
    } catch (error) {
      console.error('Error fetching worker payments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load worker payments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const csvHeader = 'Worker Name,Email,Jobs Completed,Total Owed\n';
    const csvRows = workerPayments.map(p => 
      `"${p.worker_name}","${p.worker_email}",${p.jobs_completed},${p.total_owed.toFixed(2)}`
    ).join('\n');
    const csvFooter = `\nTOTAL PAYROLL,,${workerPayments.reduce((sum, p) => sum + p.jobs_completed, 0)},${totalPayroll.toFixed(2)}`;
    const csvContent = csvHeader + csvRows + csvFooter;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worker-payments-${format(currentWeekStart, 'yyyy-MM-dd')}-to-${format(weekEnd, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Worker payments exported to CSV',
    });
  };

  const handlePreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const handleCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const isCurrentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd') === format(currentWeekStart, 'yyyy-MM-dd');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Worker Weekly Payments</h1>
          <p className="text-sm text-muted-foreground">
            {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={workerPayments.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousWeek}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Week
        </Button>
        
        {!isCurrentWeek && (
          <Button
            variant="default"
            size="sm"
            onClick={handleCurrentWeek}
            className="gap-1"
          >
            <Calendar className="h-4 w-4" />
            Current Week
          </Button>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextWeek}
          className="gap-1"
        >
          Next Week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Total Payroll Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-200">Total Payroll This Week</p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {workerPayments.length} worker{workerPayments.length !== 1 ? 's' : ''} with earnings
                </p>
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(totalPayroll)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worker Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Worker Payments</CardTitle>
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
          ) : workerPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No worker payments this week</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workerPayments.map(payment => (
                <div
                  key={payment.worker_id}
                  className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {payment.worker_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {payment.worker_email}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {payment.jobs_completed} job{payment.jobs_completed !== 1 ? 's' : ''} completed
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">
                      {formatCurrency(payment.total_owed)}
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
