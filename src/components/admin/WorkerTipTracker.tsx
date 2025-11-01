import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { deleteTransactions } from "@/utils/transactionCleanup";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  RefreshCw,
  Download,
  Trash2
} from "lucide-react";

interface TipSummary {
  worker_id: string;
  worker_name: string;
  total_tips: number;
  tip_count: number;
  avg_tip: number;
  latest_tip_date: string;
}

interface TipDetail {
  booking_id: string;
  customer_name: string;
  tip_amount: number;
  service_date: string;
  created_at: string;
}

export function WorkerTipTracker() {
  const [loading, setLoading] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [tipSummaries, setTipSummaries] = useState<TipSummary[]>([]);
  const [selectedWorkerTips, setSelectedWorkerTips] = useState<TipDetail[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTipSummaries();
  }, []);

  const loadTipSummaries = async () => {
    try {
      setLoading(true);
      
      // Use the new tip_amount column for efficient querying
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          worker_id,
          tip_amount,
          scheduled_date,
          created_at,
          users!worker_id (
            name
          )
        `)
        .not('worker_id', 'is', null)
        .gt('tip_amount', 0);

      if (error) throw error;

      // Process data to create tip summaries
      const workerTipMap = new Map<string, {
        worker_name: string;
        tips: number[];
        dates: string[];
      }>();

      data?.forEach((booking) => {
        const tipAmount = Number(booking.tip_amount);
        if (tipAmount > 0 && booking.worker_id) {
          const users = booking.users as any;
          const existing = workerTipMap.get(booking.worker_id) || {
            worker_name: users?.name || 'Unknown Worker',
            tips: [],
            dates: []
          };
          
          existing.tips.push(tipAmount);
          existing.dates.push(booking.scheduled_date);
          workerTipMap.set(booking.worker_id, existing);
        }
      });

      // Convert to summary format
      const summaries: TipSummary[] = Array.from(workerTipMap.entries()).map(([workerId, data]) => ({
        worker_id: workerId,
        worker_name: data.worker_name,
        total_tips: data.tips.reduce((sum, tip) => sum + tip, 0),
        tip_count: data.tips.length,
        avg_tip: data.tips.reduce((sum, tip) => sum + tip, 0) / data.tips.length,
        latest_tip_date: Math.max(...data.dates.map(d => new Date(d).getTime())).toString()
      })).sort((a, b) => b.total_tips - a.total_tips);

      setTipSummaries(summaries);
    } catch (error: any) {
      console.error('Error loading tip summaries:', error);
      toast({
        title: "Loading Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWorkerTipDetails = async (workerId: string) => {
    try {
      setSelectedWorkerId(workerId);
      
      // Use the new tip_amount column
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          tip_amount,
          scheduled_date,
          created_at,
          customer_id,
          guest_customer_info,
          users!customer_id (
            name
          )
        `)
        .eq('worker_id', workerId)
        .gt('tip_amount', 0);

      if (error) throw error;

      const details: TipDetail[] = data
        ?.map(booking => {
          const users = booking.users as any;
          const guestInfo = booking.guest_customer_info as any;
          const customerName = users?.name || guestInfo?.name || 'Guest Customer';
          
          return {
            booking_id: booking.id,
            customer_name: customerName,
            tip_amount: Number(booking.tip_amount),
            service_date: booking.scheduled_date,
            created_at: booking.created_at
          };
        })
        .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime()) || [];

      setSelectedWorkerTips(details);
    } catch (error: any) {
      console.error('Error loading worker tip details:', error);
      toast({
        title: "Loading Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const cleanupDuplicateTransactions = async () => {
    try {
      setCleaningUp(true);
      
      // Eric Green's duplicate transaction IDs
      const duplicateIds = [
        '9e572205-406a-4974-ae87-752e4d394542', // duplicate $230 authorized
        '79f6ee2f-202c-4c8f-89a4-ee09560618b8'  // invalid $4 pending
      ];
      
      const result = await deleteTransactions(duplicateIds);
      
      if (result.success) {
        toast({
          title: "Cleanup Complete",
          description: "Duplicate transactions removed successfully"
        });
        // Reload the tip summaries to reflect changes
        await loadTipSummaries();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Error cleaning up transactions:', error);
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const exportTipData = async () => {
    try {
      const csvContent = [
        ['Worker Name', 'Total Tips', 'Tip Count', 'Average Tip', 'Latest Tip Date'],
        ...tipSummaries.map(summary => [
          summary.worker_name,
          `$${summary.total_tips.toFixed(2)}`,
          summary.tip_count.toString(),
          `$${summary.avg_tip.toFixed(2)}`,
          new Date(summary.latest_tip_date).toLocaleDateString()
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `worker-tips-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Complete",
        description: "Tip data exported successfully"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export tip data",
        variant: "destructive"
      });
    }
  };

  const totalTipsAllWorkers = tipSummaries.reduce((sum, worker) => sum + worker.total_tips, 0);
  const totalTipCount = tipSummaries.reduce((sum, worker) => sum + worker.tip_count, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Worker Tip Tracker
        </CardTitle>
        <CardDescription>
          Track and analyze tips received by workers for their services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Tip Summary</TabsTrigger>
            <TabsTrigger value="details">Tip Details</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="grid grid-cols-3 gap-4 flex-1">
                <Card className="bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Tips</p>
                        <p className="text-lg font-semibold">${totalTipsAllWorkers.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-secondary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-secondary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Workers with Tips</p>
                        <p className="text-lg font-semibold">{tipSummaries.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-accent/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-accent" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Tips Given</p>
                        <p className="text-lg font-semibold">{totalTipCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex gap-2 ml-4">
                <Button 
                  onClick={cleanupDuplicateTransactions} 
                  disabled={loading || cleaningUp} 
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className={`h-4 w-4 ${cleaningUp ? 'animate-pulse' : ''}`} />
                </Button>
                <Button onClick={loadTipSummaries} disabled={loading} variant="outline">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button onClick={exportTipData} disabled={loading} variant="outline">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {tipSummaries.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No tip data found. Workers will appear here once customers add tips to their bookings.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="border rounded-lg">
                <div className="p-4 bg-muted/30 border-b">
                  <div className="grid grid-cols-5 gap-4 font-medium text-sm">
                    <div>Worker Name</div>
                    <div>Total Tips</div>
                    <div>Tip Count</div>
                    <div>Average Tip</div>
                    <div>Latest Tip</div>
                  </div>
                </div>
                <div className="divide-y">
                  {tipSummaries.map((summary) => (
                    <div 
                      key={summary.worker_id}
                      className="p-4 hover:bg-muted/20 cursor-pointer"
                      onClick={() => loadWorkerTipDetails(summary.worker_id)}
                    >
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div className="font-medium">{summary.worker_name}</div>
                        <div className="text-green-600 font-semibold">${summary.total_tips.toFixed(2)}</div>
                        <div>{summary.tip_count}</div>
                        <div>${summary.avg_tip.toFixed(2)}</div>
                        <div>{new Date(summary.latest_tip_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="details" className="space-y-4">
            {selectedWorkerId ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4" />
                  <h3 className="font-medium">
                    Tips for {tipSummaries.find(w => w.worker_id === selectedWorkerId)?.worker_name}
                  </h3>
                </div>
                
                {selectedWorkerTips.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No detailed tip data found for this worker.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="border rounded-lg">
                    <div className="p-4 bg-muted/30 border-b">
                      <div className="grid grid-cols-4 gap-4 font-medium text-sm">
                        <div>Customer</div>
                        <div>Tip Amount</div>
                        <div>Service Date</div>
                        <div>Booking ID</div>
                      </div>
                    </div>
                    <div className="divide-y">
                      {selectedWorkerTips.map((tip) => (
                        <div key={tip.booking_id} className="p-4 hover:bg-muted/20">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>{tip.customer_name}</div>
                            <div className="text-green-600 font-semibold">${tip.tip_amount.toFixed(2)}</div>
                            <div>{new Date(tip.service_date).toLocaleDateString()}</div>
                            <div className="font-mono text-xs">{tip.booking_id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Select a worker from the Summary tab to view their detailed tip history.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}