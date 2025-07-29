import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, AlertCircle, CheckCircle } from 'lucide-react';

interface EmailLog {
  id: string;
  booking_id: string;
  recipient_email: string;
  subject: string;
  status: string;
  created_at: string;
  sent_at?: string;
  error_message?: string;
}

export const EmailTestSuite = () => {
  const [testing, setTesting] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [testResults, setTestResults] = useState<{
    workerEmail?: { success: boolean; message: string };
    customerEmail?: { success: boolean; message: string };
  }>({});
  const { toast } = useToast();

  const TEST_BOOKING_ID = '1364c530-90bc-4673-a249-bcd24a9edfd7';

  const fetchEmailLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('booking_id', TEST_BOOKING_ID)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error) {
      console.error('Failed to fetch email logs:', error);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
    
    // Set up real-time subscription for email logs
    const subscription = supabase
      .channel('email_logs_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'email_logs',
          filter: `booking_id=eq.${TEST_BOOKING_ID}`
        }, 
        () => {
          fetchEmailLogs();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const testWorkerEmail = async () => {
    try {
      console.log('Testing worker assignment email...');
      
      const { data, error } = await supabase.functions.invoke('send-worker-assignment-email', {
        body: { bookingId: TEST_BOOKING_ID }
      });

      if (error) {
        console.error('Worker email error:', error);
        setTestResults(prev => ({
          ...prev,
          workerEmail: { success: false, message: error.message }
        }));
        return false;
      }

      console.log('Worker email response:', data);
      setTestResults(prev => ({
        ...prev,
        workerEmail: { success: true, message: 'Worker email sent successfully' }
      }));
      return true;
    } catch (error: any) {
      console.error('Worker email test failed:', error);
      setTestResults(prev => ({
        ...prev,
        workerEmail: { success: false, message: error.message }
      }));
      return false;
    }
  };

  const testCustomerEmail = async () => {
    try {
      console.log('Testing customer confirmation email...');
      
      const { data, error } = await supabase.functions.invoke('send-customer-booking-confirmation-email', {
        body: { bookingId: TEST_BOOKING_ID }
      });

      if (error) {
        console.error('Customer email error:', error);
        setTestResults(prev => ({
          ...prev,
          customerEmail: { success: false, message: error.message }
        }));
        return false;
      }

      console.log('Customer email response:', data);
      setTestResults(prev => ({
        ...prev,
        customerEmail: { success: true, message: 'Customer email sent successfully' }
      }));
      return true;
    } catch (error: any) {
      console.error('Customer email test failed:', error);
      setTestResults(prev => ({
        ...prev,
        customerEmail: { success: false, message: error.message }
      }));
      return false;
    }
  };

  const runFullEmailTest = async () => {
    setTesting(true);
    setTestResults({});
    
    try {
      toast({
        title: "Email Test Started",
        description: "Testing both worker and customer email functionality...",
      });

      // Test worker email
      const workerSuccess = await testWorkerEmail();
      
      // Wait a moment before testing customer email
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test customer email
      const customerSuccess = await testCustomerEmail();

      // Wait for logs to update
      setTimeout(() => {
        fetchEmailLogs();
      }, 2000);

      if (workerSuccess && customerSuccess) {
        toast({
          title: "Email Tests Completed",
          description: "Both email types sent successfully!",
        });
      } else {
        toast({
          title: "Email Tests Completed",
          description: "Some tests failed - check logs for details",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Full email test failed:', error);
      toast({
        title: "Email Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Functionality Test Suite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="test" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="test">Run Tests</TabsTrigger>
            <TabsTrigger value="logs">Email Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="test" className="space-y-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Testing with booking ID: <code className="bg-muted px-1 rounded">{TEST_BOOKING_ID}</code>
              </div>
              
              <div className="flex gap-4">
                <Button 
                  onClick={testWorkerEmail} 
                  disabled={testing}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Test Worker Email
                </Button>
                
                <Button 
                  onClick={testCustomerEmail} 
                  disabled={testing}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Test Customer Email
                </Button>
              </div>
              
              <Button 
                onClick={runFullEmailTest} 
                disabled={testing}
                className="w-full"
              >
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Run Complete Email Test Suite
              </Button>
              
              {/* Test Results */}
              {Object.keys(testResults).length > 0 && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium">Test Results:</h4>
                  {testResults.workerEmail && (
                    <div className="flex items-center gap-2">
                      {testResults.workerEmail.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">Worker Email: {testResults.workerEmail.message}</span>
                    </div>
                  )}
                  {testResults.customerEmail && (
                    <div className="flex items-center gap-2">
                      {testResults.customerEmail.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">Customer Email: {testResults.customerEmail.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="logs" className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Recent Email Logs</h4>
              <Button onClick={fetchEmailLogs} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {emailLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No email logs found for test booking
                </div>
              ) : (
                emailLogs.map((log) => (
                  <div key={log.id} className="p-3 border rounded-lg space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{log.subject}</div>
                        <div className="text-sm text-muted-foreground">To: {log.recipient_email}</div>
                      </div>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(log.created_at).toLocaleString()}
                      {log.sent_at && ` | Sent: ${new Date(log.sent_at).toLocaleString()}`}
                    </div>
                    {log.error_message && (
                      <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                        Error: {log.error_message}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};