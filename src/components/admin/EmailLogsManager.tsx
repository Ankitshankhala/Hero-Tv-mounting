import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, RefreshCw, Mail, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface EmailLog {
  id: string;
  booking_id: string | null;
  recipient_email: string;
  subject: string;
  message: string;
  status: string;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

export const EmailLogsManager = () => {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchEmailLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`recipient_email.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%,booking_id.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error) {
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
  }, [searchTerm, statusFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Mail className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      sent: 'default',
      failed: 'destructive',
      pending: 'secondary',
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Email Logs</h2>
        <Button onClick={fetchEmailLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Search by email, subject, or booking ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="all">All Status</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Logs ({emailLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : emailLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No email logs found
            </div>
          ) : (
            <div className="space-y-4">
              {emailLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <span className="font-medium">{log.recipient_email}</span>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Subject:</span>
                      <p className="text-sm">{truncateText(log.subject)}</p>
                    </div>
                    {log.booking_id && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Booking ID:</span>
                        <p className="text-sm font-mono">{log.booking_id}</p>
                      </div>
                    )}
                  </div>

                  {log.error_message && (
                    <div>
                      <span className="text-sm font-medium text-red-600">Error:</span>
                      <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {log.error_message}
                      </p>
                    </div>
                  )}

                  {log.sent_at && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Sent at:</span>
                      <p className="text-sm">
                        {format(new Date(log.sent_at), 'MMM dd, yyyy HH:mm:ss')}
                      </p>
                    </div>
                  )}

                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      View Message Content
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded border max-h-40 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-xs">
                        {log.message}
                      </pre>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};