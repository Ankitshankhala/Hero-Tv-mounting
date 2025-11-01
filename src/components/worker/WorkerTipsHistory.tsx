import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TipBookingDetail {
  booking_id: string;
  booking_date?: string;
  service_date?: string;
  service_name?: string;
  tip_amount: number;
  customer_name?: string;
  payment_status: string;
  booking_status?: string;
  created_at?: string;
  customer_email?: string;
  customer_id?: string;
  has_duplicate_transactions?: boolean;
  payment_intent_id?: string;
}

interface TipStats {
  totalTips: number;
  thisMonthTips: number;
  averageTip: number;
  highestTip: number;
  tipCount: number;
}

export function WorkerTipsHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tipsData, setTipsData] = useState<TipBookingDetail[]>([]);
  const [stats, setStats] = useState<TipStats>({
    totalTips: 0,
    thisMonthTips: 0,
    averageTip: 0,
    highestTip: 0,
    tipCount: 0
  });

  useEffect(() => {
    if (user) {
      fetchTipsData();
    }
  }, [user]);

  const fetchTipsData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch detailed tips history
      const { data: bookingDetails, error: detailsError } = await supabase
        .rpc('get_worker_tip_booking_details', {
          p_worker_id: user.id,
          p_start_date: null,
          p_end_date: null
        });

      if (detailsError) {
        console.error('Error fetching tips details:', detailsError);
        toast({
          title: "Error Loading Tips",
          description: "Failed to load tips history. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const capturedTips = (bookingDetails || []).filter(
        (tip: any) => tip.payment_status === 'captured'
      );

      setTipsData(capturedTips);

      // Calculate statistics
      const totalTips = capturedTips.reduce((sum: number, tip: any) => sum + (tip.tip_amount || 0), 0);
      const tipCount = capturedTips.length;
      const averageTip = tipCount > 0 ? totalTips / tipCount : 0;
      const highestTip = capturedTips.length > 0 
        ? Math.max(...capturedTips.map((tip: any) => tip.tip_amount || 0))
        : 0;

      // Calculate this month's tips
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const thisMonthTips = capturedTips
        .filter((tip: any) => {
          const tipDate = new Date(tip.booking_date || tip.service_date || tip.created_at);
          return tipDate.getMonth() === currentMonth && tipDate.getFullYear() === currentYear;
        })
        .reduce((sum: number, tip: any) => sum + (tip.tip_amount || 0), 0);

      setStats({
        totalTips,
        thisMonthTips,
        averageTip,
        highestTip,
        tipCount
      });

    } catch (error) {
      console.error('Error in fetchTipsData:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading tips.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-purple-400" />
            Tips History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading tips history...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-purple-400" />
          Tips History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">This Month</span>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              ${stats.thisMonthTips.toFixed(2)}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Average Tip</span>
              <DollarSign className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              ${stats.averageTip.toFixed(2)}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Highest Tip</span>
              <DollarSign className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              ${stats.highestTip.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Total Tips Banner */}
        <div className="p-6 rounded-lg bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Captured Tips</div>
              <div className="text-3xl font-bold text-foreground">
                ${stats.totalTips.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                From {stats.tipCount} completed {stats.tipCount === 1 ? 'job' : 'jobs'}
              </div>
            </div>
            <DollarSign className="h-12 w-12 text-purple-400" />
          </div>
        </div>

        {/* Tips Table */}
        {tipsData.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Tips</h3>
            <div className="space-y-2">
              {tipsData.slice(0, 10).map((tip) => (
                <div
                  key={tip.booking_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {format(new Date(tip.booking_date || tip.service_date || tip.created_at || new Date()), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tip.service_name || 'Service'}
                    </div>
                    {tip.customer_name && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Customer: {tip.customer_name}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      ${tip.tip_amount.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {tipsData.length > 10 && (
              <div className="text-center text-sm text-muted-foreground pt-2">
                Showing 10 of {tipsData.length} tips
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No captured tips yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tips will appear here once jobs are completed and payments are captured
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
