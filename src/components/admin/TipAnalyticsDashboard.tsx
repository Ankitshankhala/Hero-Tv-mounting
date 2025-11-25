import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, Users, Calendar, Download, RefreshCw } from "lucide-react";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { TipBookingDetailsRow } from "./TipBookingDetailsRow";
import { ManualTipCorrection } from "./ManualTipCorrection";

interface TipAnalytics {
  worker_id: string;
  worker_name: string;
  total_bookings: number;
  bookings_with_tips: number;
  tip_percentage: number;
  total_tips: number;
  avg_tip: number;
  max_tip: number;
}
export function TipAnalyticsDashboard() {
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<TipAnalytics[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);
  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const startDate = dateRange?.from?.toISOString().split('T')[0];
      const endDate = dateRange?.to?.toISOString().split('T')[0];
      const {
        data,
        error
      } = await supabase.rpc('get_tip_analytics', {
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });
      if (error) throw error;
      setAnalytics(data || []);
    } catch (error: any) {
      console.error('Error loading tip analytics:', error);
      toast({
        title: "Loading Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const exportAnalytics = () => {
    try {
      const csvContent = [['Worker Name', 'Total Bookings', 'Bookings w/ Tips', 'Tip %', 'Total Tips', 'Avg Tip', 'Max Tip'], ...analytics.map(a => [a.worker_name, a.total_bookings, a.bookings_with_tips, `${a.tip_percentage}%`, `$${a.total_tips.toFixed(2)}`, `$${a.avg_tip.toFixed(2)}`, `$${a.max_tip.toFixed(2)}`])].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], {
        type: 'text/csv'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `tip-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Export Complete",
        description: "Analytics exported successfully"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics",
        variant: "destructive"
      });
    }
  };
  const totalTips = analytics.reduce((sum, a) => sum + a.total_tips, 0);
  const totalBookings = analytics.reduce((sum, a) => sum + a.total_bookings, 0);
  const totalBookingsWithTips = analytics.reduce((sum, a) => sum + a.bookings_with_tips, 0);
  const avgTipPercentage = totalBookings > 0 ? (totalBookingsWithTips / totalBookings * 100).toFixed(1) : '0';
  return <div className="space-y-6">
      {/* Manual Tip Correction Tool */}
      <ManualTipCorrection />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-50">Tip Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive tip performance across all workers
          </p>
        </div>
        <div className="flex gap-2">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          <Button onClick={loadAnalytics} disabled={loading} variant="outline" size="icon">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={exportAnalytics} disabled={loading} variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Total Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalTips.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Across {analytics.length} workers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {totalBookingsWithTips} with tips
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Tip Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTipPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              Of all bookings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-600" />
              Workers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.length}</div>
            <p className="text-xs text-muted-foreground">
              Active workers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Worker Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Worker Performance Breakdown</CardTitle>
          <CardDescription>
            Detailed tip statistics by worker
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.length === 0 ? <div className="text-center py-8 text-muted-foreground">
              No tip data available for the selected period
            </div> : <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 p-4 border-b">
                <div className="grid grid-cols-8 gap-4 font-medium text-sm">
                  <div>Worker</div>
                  <div className="text-right">Bookings</div>
                  <div className="text-right">Tips Received</div>
                  <div className="text-right">Tip Rate</div>
                  <div className="text-right">Total Tips</div>
                  <div className="text-right">Avg Tip</div>
                  <div className="text-right">Max Tip</div>
                  <div></div>
                </div>
              </div>
              <div className="divide-y">
                {analytics.map(worker => <div key={worker.worker_id}>
                    <div className="p-4 hover:bg-muted/20">
                      <div className="grid grid-cols-8 gap-4 text-sm items-center">
                        <div className="flex items-center gap-2">
                          <TipBookingDetailsRow 
                            workerId={worker.worker_id}
                            workerName={worker.worker_name}
                            startDate={dateRange?.from?.toISOString().split('T')[0]}
                            endDate={dateRange?.to?.toISOString().split('T')[0]}
                          />
                          <span className="font-medium">{worker.worker_name}</span>
                        </div>
                        <div className="text-right">{worker.total_bookings}</div>
                        <div className="text-right">{worker.bookings_with_tips}</div>
                        <div className="text-right">
                          <span className={`font-medium ${worker.tip_percentage > 50 ? 'text-green-600' : ''}`}>
                            {worker.tip_percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-right font-semibold text-green-600">
                          ${worker.total_tips.toFixed(2)}
                        </div>
                        <div className="text-right">${worker.avg_tip.toFixed(2)}</div>
                        <div className="text-right">${worker.max_tip.toFixed(2)}</div>
                        <div></div>
                      </div>
                    </div>
                  </div>)}
              </div>
            </div>}
        </CardContent>
      </Card>
    </div>;
}