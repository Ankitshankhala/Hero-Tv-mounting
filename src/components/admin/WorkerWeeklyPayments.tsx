import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Download, DollarSign, ChevronDown, ChevronUp, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import { calculateWorkerEarnings, formatCurrency, type WorkerEarningsBreakdown } from '@/utils/workerEarningsCalculator';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { PayrollWeekNavigation } from '@/components/payroll/PayrollWeekNavigation';

interface ServiceLineItem {
  service_name: string;
  base_price: number;
  quantity: number;
}

interface JobDetail {
  booking_id: string;
  scheduled_date: string;
  scheduled_start: string;
  customer_name: string;
  services: ServiceLineItem[];
  tip_amount: number;
  earnings: WorkerEarningsBreakdown;
}

interface DailyEarnings {
  date: Date;
  dayName: string;
  dayShort: string;
  jobs: JobDetail[];
  dayTotal: number;
}

interface WorkerPaymentDetailed {
  worker_id: string;
  worker_name: string;
  worker_email: string;
  jobs_completed: number;
  total_owed: number;
  dailyBreakdown: DailyEarnings[];
  isExpanded: boolean;
}

export function WorkerWeeklyPayments() {
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [workerPayments, setWorkerPayments] = useState<WorkerPaymentDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPayroll, setTotalPayroll] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Record<string, string | null>>({});

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

      const payments: WorkerPaymentDetailed[] = [];
      let payrollTotal = 0;

      // For each worker, fetch their bookings for the week
      for (const worker of workers || []) {
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            scheduled_date,
            scheduled_start,
            tip_amount,
            guest_customer_info,
            customer_id,
            booking_services (
              service_name,
              base_price,
              quantity
            )
          `)
          .eq('worker_id', worker.id)
          .or('status.eq.completed,payment_status.eq.captured')
          .not('status', 'in', '("cancelled","refunded")')
          .gte('scheduled_date', format(currentWeekStart, 'yyyy-MM-dd'))
          .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
          .order('scheduled_date', { ascending: true })
          .order('scheduled_start', { ascending: true });

        if (bookingsError) {
          console.error(`Error fetching bookings for worker ${worker.id}:`, bookingsError);
          continue;
        }

        // Get customer names for bookings
        const customerIds = bookings?.filter(b => b.customer_id).map(b => b.customer_id) || [];
        let customerMap: Record<string, string> = {};
        
        if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from('users')
            .select('id, name')
            .in('id', customerIds);
          
          customerMap = (customers || []).reduce((acc, c) => {
            acc[c.id] = c.name || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }

        // Create daily breakdown
        const dailyMap = new Map<string, JobDetail[]>();
        let workerTotal = 0;

        bookings?.forEach(booking => {
          const services = (booking.booking_services || []).map((s: any) => ({
            service_name: s.service_name,
            base_price: s.base_price,
            quantity: s.quantity,
          }));

          const tipAmount = booking.tip_amount || 0;
          const earnings = calculateWorkerEarnings(services, tipAmount);
          workerTotal += earnings.totalEarnings;

          // Get customer name
          let customerName = 'Guest';
          if (booking.customer_id && customerMap[booking.customer_id]) {
            customerName = customerMap[booking.customer_id];
          } else if (booking.guest_customer_info && typeof booking.guest_customer_info === 'object') {
            const guestInfo = booking.guest_customer_info as any;
            customerName = guestInfo.name || 'Guest';
          }

          const jobDetail: JobDetail = {
            booking_id: booking.id,
            scheduled_date: booking.scheduled_date,
            scheduled_start: booking.scheduled_start,
            customer_name: customerName,
            services,
            tip_amount: tipAmount,
            earnings,
          };

          const dateKey = booking.scheduled_date;
          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, []);
          }
          dailyMap.get(dateKey)!.push(jobDetail);
        });

        // Create daily breakdown array for all 7 days of the week
        const dailyBreakdown: DailyEarnings[] = [];
        for (let i = 0; i < 7; i++) {
          const date = addDays(currentWeekStart, i);
          const dateKey = format(date, 'yyyy-MM-dd');
          const jobs = dailyMap.get(dateKey) || [];
          const dayTotal = jobs.reduce((sum, job) => sum + job.earnings.totalEarnings, 0);

          dailyBreakdown.push({
            date,
            dayName: format(date, 'EEEE'),
            dayShort: format(date, 'EEE'),
            jobs,
            dayTotal,
          });
        }

        if (bookings && bookings.length > 0) {
          payments.push({
            worker_id: worker.id,
            worker_name: worker.name || 'Unknown',
            worker_email: worker.email || '',
            jobs_completed: bookings.length,
            total_owed: workerTotal,
            dailyBreakdown,
            isExpanded: false,
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

  const toggleWorkerExpansion = (workerId: string) => {
    setWorkerPayments(prev => prev.map(w => 
      w.worker_id === workerId ? { ...w, isExpanded: !w.isExpanded } : w
    ));
  };

  const toggleDayExpansion = (workerId: string, dayName: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [workerId]: prev[workerId] === dayName ? null : dayName,
    }));
  };

  const handleExportCSV = () => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    let csvContent = 'Worker Name,Email,Day,Date,Jobs,Daily Total,Weekly Total\n';
    
    workerPayments.forEach(worker => {
      worker.dailyBreakdown.forEach(day => {
        csvContent += `"${worker.worker_name}","${worker.worker_email}","${day.dayName}","${format(day.date, 'yyyy-MM-dd')}",${day.jobs.length},${day.dayTotal.toFixed(2)},${worker.total_owed.toFixed(2)}\n`;
      });
      csvContent += '\n';
    });
    
    csvContent += `\nTOTAL PAYROLL,,,,${workerPayments.reduce((sum, p) => sum + p.jobs_completed, 0)},${totalPayroll.toFixed(2)},${totalPayroll.toFixed(2)}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worker-payroll-detailed-${format(currentWeekStart, 'yyyy-MM-dd')}-to-${format(weekEnd, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Detailed payroll exported to CSV',
    });
  };

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-primary-foreground">Worker Weekly Payments</h1>
        
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

      {/* Week Navigation */}
      <PayrollWeekNavigation
        currentWeekStart={currentWeekStart}
        onWeekChange={setCurrentWeekStart}
      />

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
            <div className="space-y-4">
              {workerPayments.map(payment => (
                <Collapsible
                  key={payment.worker_id}
                  open={payment.isExpanded}
                  onOpenChange={() => toggleWorkerExpansion(payment.worker_id)}
                >
                  <div className="border border-border rounded-lg overflow-hidden">
                    {/* Worker Summary Row */}
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3 flex-1">
                          {payment.isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="text-left flex-1">
                            <div className="font-semibold text-foreground">
                              {payment.worker_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {payment.worker_email} • {payment.jobs_completed} job{payment.jobs_completed !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        
                        {/* Mini Bar Chart */}
                        <div className="hidden md:flex items-end gap-1 mx-4 h-8">
                          {payment.dailyBreakdown.map((day, idx) => {
                            const maxAmount = Math.max(...payment.dailyBreakdown.map(d => d.dayTotal));
                            const heightPercent = maxAmount > 0 ? (day.dayTotal / maxAmount) * 100 : 0;
                            return (
                              <div key={idx} className="flex flex-col items-center gap-1">
                                <div 
                                  className={cn(
                                    "w-8 rounded-t transition-all",
                                    day.dayTotal === 0 ? "bg-muted" : "bg-primary/70"
                                  )}
                                  style={{ height: `${Math.max(heightPercent, 3)}%` }}
                                />
                                <span className="text-xs text-muted-foreground">{day.dayShort}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-xl font-bold text-foreground">
                            {formatCurrency(payment.total_owed)}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    {/* Expanded Day-by-Day Breakdown */}
                    <CollapsibleContent>
                      <div className="border-t border-border">
                        {payment.dailyBreakdown.map((day, dayIdx) => (
                          <div key={dayIdx} className="border-b border-border last:border-b-0">
                            <Collapsible
                              open={expandedDays[payment.worker_id] === day.dayName}
                              onOpenChange={() => toggleDayExpansion(payment.worker_id, day.dayName)}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div className={cn(
                                  "flex items-center justify-between p-3 pl-12 hover:bg-muted/30 transition-colors cursor-pointer",
                                  day.jobs.length === 0 && "opacity-50"
                                )}>
                                  <div className="flex items-center gap-2">
                                    {day.jobs.length > 0 ? (
                                      expandedDays[payment.worker_id] === day.dayName ? (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      )
                                    ) : (
                                      <div className="w-4" />
                                    )}
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <div className="text-left">
                                      <div className="font-medium text-sm text-foreground">
                                        {day.dayName}, {format(day.date, 'MMM d')}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {day.jobs.length} job{day.jobs.length !== 1 ? 's' : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <div className={cn(
                                    "font-semibold",
                                    day.dayTotal > 0 ? "text-foreground" : "text-muted-foreground"
                                  )}>
                                    {formatCurrency(day.dayTotal)}
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              {/* Expanded Job Details */}
                              {day.jobs.length > 0 && (
                                <CollapsibleContent>
                                  <div className="bg-muted/20 px-6 py-3 space-y-3">
                                    {day.jobs.map((job, jobIdx) => (
                                      <div key={jobIdx} className="bg-background rounded-lg p-4 border border-border">
                                        <div className="flex items-start justify-between mb-3">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <User className="h-4 w-4 text-muted-foreground" />
                                              <span className="font-medium text-sm text-foreground">
                                                {job.customer_name}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                              <Clock className="h-3 w-3" />
                                              {format(parseISO(`${job.scheduled_date}T${job.scheduled_start}`), 'h:mm a')}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-lg font-bold text-foreground">
                                              {formatCurrency(job.earnings.totalEarnings)}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Earnings Breakdown */}
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>Services Total:</span>
                                            <span>{formatCurrency(job.earnings.totalCharged)}</span>
                                          </div>
                                          {job.earnings.equipmentCosts > 0 && (
                                            <div className="flex justify-between text-muted-foreground">
                                              <span>Equipment Cost:</span>
                                              <span className="text-destructive">-{formatCurrency(job.earnings.equipmentCosts)}</span>
                                            </div>
                                          )}
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>Commissionable:</span>
                                            <span>{formatCurrency(job.earnings.commissionableAmount)}</span>
                                          </div>
                                          <div className="flex justify-between font-medium">
                                            <span>Commission (60%):</span>
                                            <span className="text-primary">{formatCurrency(job.earnings.workerCommission)}</span>
                                          </div>
                                          {job.tip_amount > 0 && (
                                            <div className="flex justify-between font-medium">
                                              <span>Tip:</span>
                                              <span className="text-green-600 dark:text-green-400">+{formatCurrency(job.tip_amount)}</span>
                                            </div>
                                          )}
                                          <div className="pt-2 border-t border-border flex justify-between font-bold">
                                            <span>Worker Earnings:</span>
                                            <span className="text-foreground">{formatCurrency(job.earnings.totalEarnings)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              )}
                            </Collapsible>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
