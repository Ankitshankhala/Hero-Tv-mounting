import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StuckPayment {
  id: string;
  payment_intent_id: string;
  payment_status: string;
  status: string;
  created_at: string;
  guest_customer_info?: any;
}

export const PaymentRecoveryTools = () => {
  const [stuckPayments, setStuckPayments] = useState<StuckPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const findStuckPayments = async () => {
    setLoading(true);
    try {
      // Look for various types of stuck payments
      const { data, error } = await supabase
        .from('bookings')
        .select('id, payment_intent_id, payment_status, status, created_at, guest_customer_info')
        .or('payment_status.eq.authorized,payment_status.eq.capture_failed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStuckPayments(data || []);
      
      const authorizedCount = data?.filter(p => p.payment_status === 'authorized').length || 0;
      const failedCount = data?.filter(p => p.payment_status === 'capture_failed').length || 0;
      
      toast({
        title: "Scan Complete",
        description: `Found ${authorizedCount} authorized payments and ${failedCount} failed captures`,
      });
    } catch (error) {
      console.error('Payment scan error:', error);
      toast({
        title: "Scan Failed",
        description: "Unable to scan for stuck payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const retryCapture = async (bookingId: string) => {
    setProcessing(bookingId);
    try {
      console.log('Admin retry capture for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('capture-payment-intent', {
        body: { booking_id: bookingId }
      });

      console.log('Admin capture response:', { data, error });

      if (error) {
        console.error('Admin capture error:', error);
        throw new Error(error.message || 'Failed to invoke capture function');
      }

      if (data?.success) {
        toast({
          title: "Payment Captured Successfully",
          description: `$${data.amount_captured} ${data.currency?.toUpperCase()} captured and job completed`,
        });
        
        // Remove from stuck payments list
        setStuckPayments(prev => prev.filter(p => p.id !== bookingId));
      } else {
        throw new Error(data?.error || 'Capture failed');
      }
    } catch (error) {
      console.error('Admin capture retry error:', error);
      toast({
        title: "Capture Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCustomerName = (payment: StuckPayment) => {
    return payment.guest_customer_info?.name || 'Unknown Customer';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Payment Recovery Tools
          </div>
          <Button onClick={findStuckPayments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Scan for Issues
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stuckPayments.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Payments Requiring Attention</h4>
              <Badge variant="secondary">{stuckPayments.length} found</Badge>
            </div>
            
            {stuckPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 border rounded">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    {payment.payment_status === 'authorized' ? (
                      <DollarSign className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium">{getCustomerName(payment)}</p>
                      <p className="text-sm text-gray-600">
                        Booking ID: {payment.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {payment.payment_status === 'authorized' ? 'Authorized' : 'Failed'}: {formatDate(payment.created_at)}
                      </p>
                      {payment.payment_intent_id && (
                        <p className="text-xs text-gray-400">
                          PI: {payment.payment_intent_id.slice(-8)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={payment.payment_status === 'authorized' ? 'default' : 'destructive'}
                  >
                    {payment.payment_status}
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => retryCapture(payment.id)}
                    disabled={processing === payment.id}
                    variant={payment.payment_status === 'capture_failed' ? 'outline' : 'default'}
                  >
                    {processing === payment.id ? 'Processing...' : 
                     payment.payment_status === 'capture_failed' ? 'Retry Capture' : 'Capture Payment'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {stuckPayments.length === 0 && !loading && (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No stuck payments found</p>
            <p className="text-sm text-gray-400 mt-1">
              All payments appear to be processing correctly
            </p>
          </div>
        )}
        
        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-500">Scanning for stuck payments...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};