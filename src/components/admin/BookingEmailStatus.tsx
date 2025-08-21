import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSmsNotifications } from '@/hooks/useSmsNotifications';
import { Loader2, RefreshCw, CheckCircle, AlertCircle, Mail, Send } from 'lucide-react';

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  email_type: string;
  created_at: string;
  error_message?: string;
}

interface BookingEmailStatusProps {
  bookingId: string;
  workerId?: string;
  compact?: boolean;
}

export const BookingEmailStatus = ({ bookingId, workerId, compact = false }: BookingEmailStatusProps) => {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { toast } = useToast();
  const { resendWorkerEmail, resendCustomerEmail } = useSmsNotifications();

  const fetchEmailLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('id, recipient_email, subject, status, email_type, created_at, error_message')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching email logs:', error);
      if (!compact) {
        toast({
          title: 'Error',
          description: 'Failed to fetch email logs',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
  }, [bookingId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleForceResendWorker = async () => {
    if (!workerId) {
      toast({
        title: 'Error',
        description: 'No worker assigned to this booking',
        variant: 'destructive',
      });
      return;
    }

    setResending(true);
    try {
      const success = await resendWorkerEmail(bookingId, { force: true });
      if (success) {
        await fetchEmailLogs(); // Refresh logs
      }
    } catch (error) {
      console.error('Failed to force resend worker email:', error);
    } finally {
      setResending(false);
    }
  };

  const handleForceResendCustomer = async () => {
    setResending(true);
    try {
      const success = await resendCustomerEmail(bookingId);
      if (success) {
        await fetchEmailLogs(); // Refresh logs
      }
    } catch (error) {
      console.error('Failed to force resend customer email:', error);
    } finally {
      setResending(false);
    }
  };

  const workerEmails = emailLogs.filter(log => log.email_type === 'worker_assignment');
  const customerEmails = emailLogs.filter(log => log.email_type === 'booking_confirmation');
  const hasWorkerEmailSent = workerEmails.some(log => log.status === 'sent');
  const hasCustomerEmailSent = customerEmails.some(log => log.status === 'sent');

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <span className="text-sm font-medium">Email Status:</span>
          <Button 
            onClick={fetchEmailLogs} 
            disabled={loading}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </Button>
        </div>
        
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span>Customer:</span>
            <div className="flex items-center gap-1">
              {hasCustomerEmailSent ? (
                <Badge variant="default" className="bg-green-500 text-xs">Sent</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">Not sent</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleForceResendCustomer}
                disabled={resending}
                className="h-5 w-5 p-0"
                title="Force resend customer email"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          {workerId && (
            <div className="flex items-center justify-between">
              <span>Worker:</span>
              <div className="flex items-center gap-1">
                {hasWorkerEmailSent ? (
                  <Badge variant="default" className="bg-green-500 text-xs">Sent</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">Not sent</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleForceResendWorker}
                  disabled={resending}
                  className="h-5 w-5 p-0"
                  title="Force resend worker email"
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4" />
        <span className="font-medium">Email Delivery Status</span>
        <Button 
          onClick={fetchEmailLogs} 
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Emails */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Customer Emails</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceResendCustomer}
              disabled={resending}
            >
              {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Force Resend
            </Button>
          </div>
          {customerEmails.length === 0 ? (
            <div className="text-sm text-muted-foreground">No customer emails found</div>
          ) : (
            <div className="space-y-2">
              {customerEmails.map((log) => (
                <div key={log.id} className="p-3 border rounded-lg space-y-1">
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-medium">{log.subject}</div>
                    {getStatusBadge(log.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">To: {log.recipient_email}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                  {log.error_message && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                      Error: {log.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Worker Emails */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Worker Emails</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceResendWorker}
              disabled={resending || !workerId}
            >
              {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Force Resend
            </Button>
          </div>
          {!workerId ? (
            <div className="text-sm text-muted-foreground">No worker assigned</div>
          ) : workerEmails.length === 0 ? (
            <div className="text-sm text-muted-foreground">No worker emails found</div>
          ) : (
            <div className="space-y-2">
              {workerEmails.map((log) => (
                <div key={log.id} className="p-3 border rounded-lg space-y-1">
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-medium">{log.subject}</div>
                    {getStatusBadge(log.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">To: {log.recipient_email}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                  {log.error_message && (
                    <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                      Error: {log.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};