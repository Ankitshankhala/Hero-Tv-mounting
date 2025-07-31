import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HealthCheckResult {
  bookingsWithoutTransactions: number;
  bookingsWithMismatchedStatus: number;
  orphanedTransactions: number;
  totalBookingsWithPayments: number;
  totalTransactions: number;
  issues: string[];
}

export const PaymentHealthCheck = () => {
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    runHealthCheck();
  }, []);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      console.log('Running payment health check...');

      // Get bookings with payment data
      const { data: bookingsWithPayments, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          payment_intent_id,
          payment_status,
          status
        `)
        .not('payment_intent_id', 'is', null);

      if (bookingsError) throw bookingsError;

      // Get all transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('id, booking_id, payment_intent_id, status');

      if (transactionsError) throw transactionsError;

      // Analyze the data
      const issues: string[] = [];
      let bookingsWithoutTransactions = 0;
      let bookingsWithMismatchedStatus = 0;
      let orphanedTransactions = 0;

      // Check for bookings without transactions
      for (const booking of bookingsWithPayments || []) {
        const hasTransaction = transactions?.some(t => t.payment_intent_id === booking.payment_intent_id);
        if (!hasTransaction) {
          bookingsWithoutTransactions++;
        }
      }

      // Check for orphaned transactions
      for (const transaction of transactions || []) {
        const hasBooking = bookingsWithPayments?.some(b => b.id === transaction.booking_id);
        if (!hasBooking) {
          orphanedTransactions++;
        }
      }

      // Check for status mismatches
      for (const booking of bookingsWithPayments || []) {
        const relatedTransaction = transactions?.find(t => t.payment_intent_id === booking.payment_intent_id);
        if (relatedTransaction) {
          const bookingStatus = booking.payment_status;
          const transactionStatus = relatedTransaction.status;
          
          // Define expected mapping
          const statusMapping: Record<string, string[]> = {
            'pending': ['pending'],
            'authorized': ['authorized'],
            'completed': ['completed'],
            'failed': ['failed'],
          };

          if (statusMapping[bookingStatus] && !statusMapping[bookingStatus].includes(transactionStatus)) {
            bookingsWithMismatchedStatus++;
          }
        }
      }

      // Generate issue messages
      if (bookingsWithoutTransactions > 0) {
        issues.push(`${bookingsWithoutTransactions} bookings missing transaction records`);
      }
      if (bookingsWithMismatchedStatus > 0) {
        issues.push(`${bookingsWithMismatchedStatus} bookings with mismatched payment status`);
      }
      if (orphanedTransactions > 0) {
        issues.push(`${orphanedTransactions} orphaned transaction records`);
      }

      const result: HealthCheckResult = {
        bookingsWithoutTransactions,
        bookingsWithMismatchedStatus,
        orphanedTransactions,
        totalBookingsWithPayments: bookingsWithPayments?.length || 0,
        totalTransactions: transactions?.length || 0,
        issues,
      };

      setHealthData(result);

    } catch (error: any) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fixIssues = async () => {
    setFixing(true);
    try {
      // Call the sync function to fix missing transactions
      const { data, error } = await supabase.functions.invoke('sync-payment-transactions', {
        body: {
          action: 'create_missing_transactions'
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Issues Fixed",
          description: `Created ${data.count || 0} missing transaction records`,
        });
        
        // Re-run health check
        await runHealthCheck();
      } else {
        throw new Error(data.error || 'Fix operation failed');
      }

    } catch (error: any) {
      console.error('Fix failed:', error);
      toast({
        title: "Fix Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  const getHealthStatus = () => {
    if (!healthData) return 'unknown';
    if (healthData.issues.length === 0) return 'healthy';
    if (healthData.bookingsWithoutTransactions > 0) return 'critical';
    return 'warning';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <RefreshCw className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const healthStatus = getHealthStatus();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            {getStatusIcon(healthStatus)}
            <span>Payment System Health</span>
            {getStatusBadge(healthStatus)}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              onClick={runHealthCheck}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Check
            </Button>
            {healthData && healthData.issues.length > 0 && (
              <Button
                onClick={fixIssues}
                disabled={fixing}
                variant="default"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${fixing ? 'animate-spin' : ''}`} />
                {fixing ? 'Fixing...' : 'Fix Issues'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Running health check...</span>
          </div>
        ) : healthData ? (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{healthData.totalBookingsWithPayments}</div>
                <div className="text-sm text-gray-600">Bookings with Payments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{healthData.totalTransactions}</div>
                <div className="text-sm text-gray-600">Total Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{healthData.bookingsWithoutTransactions}</div>
                <div className="text-sm text-gray-600">Missing Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{healthData.bookingsWithMismatchedStatus}</div>
                <div className="text-sm text-gray-600">Status Mismatches</div>
              </div>
            </div>

            {/* Issues */}
            {healthData.issues.length > 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Issues Found:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {healthData.issues.map((issue, index) => (
                      <li key={index} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All payment records are consistent and properly synchronized.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            Click "Check" to run payment system health check
          </div>
        )}
      </CardContent>
    </Card>
  );
};