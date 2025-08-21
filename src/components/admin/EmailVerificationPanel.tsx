import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Mail, AlertTriangle } from "lucide-react";

interface EmailVerificationPanelProps {
  bookingId?: string;
}

interface EmailStatus {
  customer_email: boolean;
  worker_email: boolean;
  customer_email_count: number;
  worker_email_count: number;
  last_customer_email?: string;
  last_worker_email?: string;
}

export function EmailVerificationPanel({ bookingId }: EmailVerificationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const { toast } = useToast();

  const checkEmailStatus = async (targetBookingId?: string) => {
    setLoading(true);
    try {
      const bookingFilter = targetBookingId || bookingId;
      
      // Check email logs for the booking
      const { data: emails, error } = await supabase
        .from('email_logs')
        .select('email_type, status, created_at, recipient_email')
        .eq('booking_id', bookingFilter || '')
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const customerEmails = emails?.filter(e => e.email_type === 'booking_confirmation') || [];
      const workerEmails = emails?.filter(e => e.email_type === 'worker_assignment') || [];

      setStatus({
        customer_email: customerEmails.length > 0,
        worker_email: workerEmails.length > 0,
        customer_email_count: customerEmails.length,
        worker_email_count: workerEmails.length,
        last_customer_email: customerEmails[0]?.created_at,
        last_worker_email: workerEmails[0]?.created_at,
      });

      toast({
        title: "Email Status Checked",
        description: `Customer: ${customerEmails.length} sent, Worker: ${workerEmails.length} sent`,
      });

    } catch (error: any) {
      console.error('Error checking email status:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runFullHealthCheck = async () => {
    setLoading(true);
    try {
      // Check recent bookings for email delivery
      const { data: recentBookings, error } = await supabase
        .from('bookings')
        .select('id, created_at, status, payment_status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      let totalBookings = recentBookings?.length || 0;
      let customerEmailsSent = 0;
      let workerEmailsSent = 0;

      for (const booking of recentBookings || []) {
        const { data: emails } = await supabase
          .from('email_logs')
          .select('email_type')
          .eq('booking_id', booking.id)
          .eq('status', 'sent');

        const hasCustomerEmail = emails?.some(e => e.email_type === 'booking_confirmation');
        const hasWorkerEmail = emails?.some(e => e.email_type === 'worker_assignment');

        if (hasCustomerEmail) customerEmailsSent++;
        if (hasWorkerEmail) workerEmailsSent++;
      }

      toast({
        title: "Health Check Complete",
        description: `Last 24h: ${totalBookings} bookings, ${customerEmailsSent} customer emails, ${workerEmailsSent} worker emails`,
      });

    } catch (error: any) {
      console.error('Error running health check:', error);
      toast({
        title: "Health Check Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (hasEmail: boolean, count: number) => {
    if (hasEmail) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (count === 0) return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusBadge = (hasEmail: boolean, count: number) => {
    if (hasEmail) return <Badge variant="default" className="bg-green-100 text-green-800">Sent ({count})</Badge>;
    if (count === 0) return <Badge variant="destructive">Not Sent</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email System Verification
        </CardTitle>
        <CardDescription>
          Verify that both customer and worker emails are being sent for bookings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={() => checkEmailStatus()} 
            disabled={loading || !bookingId}
            variant="outline"
          >
            {loading ? "Checking..." : "Check Current Booking"}
          </Button>
          <Button 
            onClick={runFullHealthCheck} 
            disabled={loading}
            variant="default"
          >
            {loading ? "Running..." : "Run Health Check"}
          </Button>
        </div>

        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getStatusIcon(status.customer_email, status.customer_email_count)}
                  Customer Confirmation Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(status.customer_email, status.customer_email_count)}
                {status.last_customer_email && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last sent: {new Date(status.last_customer_email).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getStatusIcon(status.worker_email, status.worker_email_count)}
                  Worker Assignment Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getStatusBadge(status.worker_email, status.worker_email_count)}
                {status.last_worker_email && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last sent: {new Date(status.last_worker_email).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {status && (!status.customer_email || !status.worker_email) && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-800 font-medium">
                  Email delivery issues detected
                </span>
              </div>
              <p className="text-xs text-yellow-700 mt-1">
                Check function logs and email service configuration
              </p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}