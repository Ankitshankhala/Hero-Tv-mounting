
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  email_type: string;
  created_at: string;
  error_message?: string;
}

export const EmailLogChecker = () => {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchEmailLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('id, recipient_email, subject, status, email_type, created_at, error_message')
        .eq('booking_id', 'a3f479c5-97b5-4efd-92f3-05ce9e5512b3')
        .eq('email_type', 'worker_assignment')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      setEmailLogs(data || []);
      
      if (data && data.length > 0) {
        const latestLog = data[0];
        toast({
          title: latestLog.status === 'sent' ? 'Email Sent Successfully' : 'Email Send Failed',
          description: `Latest worker email status: ${latestLog.status}`,
          variant: latestLog.status === 'sent' ? 'default' : 'destructive',
        });
      } else {
        toast({
          title: 'No Email Logs Found',
          description: 'No worker assignment emails found for this booking',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error fetching email logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch email logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
  }, []);

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

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Worker Assignment Email Status
          <Button 
            onClick={fetchEmailLogs} 
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          Checking email logs for booking: <code className="bg-muted px-1 rounded">a3f479c5-97b5-4efd-92f3-05ce9e5512b3</code>
        </div>
        
        {emailLogs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {loading ? 'Loading email logs...' : 'No worker assignment email logs found for this booking'}
          </div>
        ) : (
          <div className="space-y-3">
            {emailLogs.map((log) => (
              <div key={log.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{log.subject}</div>
                    <div className="text-sm text-muted-foreground">To: {log.recipient_email}</div>
                  </div>
                  {getStatusBadge(log.status)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {new Date(log.created_at).toLocaleString()}
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
      </CardContent>
    </Card>
  );
};
