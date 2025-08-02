import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, DollarSign, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CaptureRecord {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  captured_at: string;
  payment_intent_id: string;
  booking: {
    guest_customer_info?: {
      name: string;
      email: string;
    };
  } | null;
}

export const PaymentCaptureHistory = () => {
  const [captureRecords, setCaptureRecords] = useState<CaptureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCaptureHistory();
    
    // Set up real-time subscription for capture events
    const channel = supabase
      .channel('capture-history')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: 'status=eq.captured'
        },
        () => {
          fetchCaptureHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCaptureHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          booking_id,
          amount,
          status,
          captured_at,
          payment_intent_id,
          booking:bookings(
            guest_customer_info
          )
        `)
        .in('status', ['captured', 'completed'])
        .not('captured_at', 'is', null)
        .order('captured_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const processedRecords = (data || []).map(record => ({
        ...record,
        booking: Array.isArray(record.booking) ? record.booking[0] : record.booking
      }));

      setCaptureRecords(processedRecords);
    } catch (error) {
      console.error('Error fetching capture history:', error);
      toast({
        title: "Error",
        description: "Failed to load payment capture history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span>Recent Payment Captures</span>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {captureRecords.length} Captured
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading capture history...</div>
        ) : captureRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No payment captures found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount Captured</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Captured At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {captureRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.booking_id?.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {record.booking?.guest_customer_info?.name || 'Unknown Customer'}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(record.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Captured
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDateTime(record.captured_at)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};