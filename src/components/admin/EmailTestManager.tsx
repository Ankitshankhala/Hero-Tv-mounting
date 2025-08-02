import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useEmailNotifications } from '@/hooks/useEmailNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Send, CheckCircle, XCircle, Clock } from 'lucide-react';

interface EmailTestResult {
  type: string;
  success: boolean;
  message: string;
  timestamp: string;
}

export const EmailTestManager = () => {
  const [testBookingId, setTestBookingId] = useState('');
  const [testResults, setTestResults] = useState<EmailTestResult[]>([]);
  const [recentEmailLogs, setRecentEmailLogs] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  
  const { toast } = useToast();
  const { 
    sendWorkerAssignmentEmail, 
    sendCustomerConfirmationEmail, 
    sendFinalInvoiceEmail,
    resendEmail 
  } = useEmailNotifications();

  const fetchRecentEmailLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentEmailLogs(data || []);
    } catch (error) {
      console.error('Error fetching email logs:', error);
    }
  };

  const addTestResult = (type: string, success: boolean, message: string) => {
    const result: EmailTestResult = {
      type,
      success,
      message,
      timestamp: new Date().toISOString()
    };
    setTestResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
  };

  const testWorkerAssignmentEmail = async () => {
    if (!testBookingId) {
      toast({
        title: "Error",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const success = await sendWorkerAssignmentEmail(testBookingId);
      addTestResult('Worker Assignment', success, success ? 'Email sent successfully' : 'Email failed to send');
      await fetchRecentEmailLogs();
    } catch (error) {
      addTestResult('Worker Assignment', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const testCustomerConfirmationEmail = async () => {
    if (!testBookingId) {
      toast({
        title: "Error",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const success = await sendCustomerConfirmationEmail(testBookingId);
      addTestResult('Customer Confirmation', success, success ? 'Email sent successfully' : 'Email failed to send');
      await fetchRecentEmailLogs();
    } catch (error) {
      addTestResult('Customer Confirmation', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const testFinalInvoiceEmail = async () => {
    if (!testBookingId) {
      toast({
        title: "Error",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const success = await sendFinalInvoiceEmail(testBookingId);
      addTestResult('Final Invoice', success, success ? 'Email sent successfully' : 'Email failed to send');
      await fetchRecentEmailLogs();
    } catch (error) {
      addTestResult('Final Invoice', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const runAllEmailTests = async () => {
    if (!testBookingId) {
      toast({
        title: "Error",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      await testWorkerAssignmentEmail();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between tests
      await testCustomerConfirmationEmail();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await testFinalInvoiceEmail();

      toast({
        title: "Email Tests Complete",
        description: "All email tests have been executed. Check results below.",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Email System Testing</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="testBookingId">Test Booking ID</Label>
            <Input
              id="testBookingId"
              value={testBookingId}
              onChange={(e) => setTestBookingId(e.target.value)}
              placeholder="Enter a booking ID to test emails"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={testWorkerAssignmentEmail}
              disabled={testing || !testBookingId}
              variant="outline"
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              Worker Email
            </Button>
            
            <Button
              onClick={testCustomerConfirmationEmail}
              disabled={testing || !testBookingId}
              variant="outline"
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              Customer Email
            </Button>
            
            <Button
              onClick={testFinalInvoiceEmail}
              disabled={testing || !testBookingId}
              variant="outline"
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              Invoice Email
            </Button>
            
            <Button
              onClick={runAllEmailTests}
              disabled={testing || !testBookingId}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              Test All
            </Button>
          </div>

          <Button
            onClick={fetchRecentEmailLogs}
            variant="ghost"
            size="sm"
          >
            Refresh Email Logs
          </Button>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    {result.success ? 
                      <CheckCircle className="h-4 w-4 text-green-500" /> : 
                      <XCircle className="h-4 w-4 text-red-500" />
                    }
                    <span className="font-medium">{result.type}</span>
                    <span className="text-sm text-gray-600">{result.message}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(result.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Email Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEmailLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent email logs</p>
          ) : (
            <div className="space-y-2">
              {recentEmailLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="font-medium">{log.subject}</div>
                      <div className="text-sm text-gray-600">
                        To: {log.recipient_email} | Booking: {log.booking_id?.slice(0, 8)}...
                      </div>
                      {log.error_message && (
                        <div className="text-xs text-red-600 mt-1">
                          Error: {log.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                      {log.status}
                    </Badge>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(log.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};