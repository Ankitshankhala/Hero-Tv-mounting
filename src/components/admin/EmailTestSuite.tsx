import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, AlertCircle, CheckCircle, Plus } from 'lucide-react';

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
    bookingCreation?: { success: boolean; message: string };
  }>({});
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [testBookingId, setTestBookingId] = useState<string | null>(null);
  const [workerEmail, setWorkerEmail] = useState('ankitshankhala2112@gmail.com');
  const { toast } = useToast();

  // Ankit's real worker ID
  const ANKIT_WORKER_ID = '1d6b0847-7e4c-454a-be20-9a843e9b6df3';

  const createTestBooking = async () => {
    setCreatingBooking(true);
    try {
      // First get a service to use
      const { data: services, error: serviceError } = await supabase
        .from('services')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (serviceError || !services?.length) {
        throw new Error('No active services found');
      }

      // Create a test booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          service_id: services[0].id,
          scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
          scheduled_start: '10:00:00',
          status: 'confirmed',
          payment_status: 'authorized',
          payment_intent_id: 'test_pi_' + Date.now(),
          guest_customer_info: {
            name: 'Test Customer',
            email: 'test@example.com',
            phone: '555-123-4567',
            zipcode: '75001',
            address: '123 Test St',
            city: 'Dallas'
          }
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      setTestBookingId(booking.id);
      setTestResults(prev => ({
        ...prev,
        bookingCreation: { success: true, message: `Test booking created: ${booking.id}` }
      }));

      toast({
        title: "Test Booking Created",
        description: `Booking ID: ${booking.id}`,
      });

      return booking.id;
    } catch (error: any) {
      console.error('Failed to create test booking:', error);
      setTestResults(prev => ({
        ...prev,
        bookingCreation: { success: false, message: error.message }
      }));
      toast({
        title: "Failed to Create Test Booking",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setCreatingBooking(false);
    }
  };

  const fetchEmailLogs = async () => {
    try {
      const bookingId = testBookingId;
      if (!bookingId) return;

      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error) {
      console.error('Failed to fetch email logs:', error);
    }
  };

  useEffect(() => {
    if (testBookingId) {
      fetchEmailLogs();
      
      // Set up real-time subscription for email logs
      const subscription = supabase
        .channel('email_logs_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'email_logs',
            filter: `booking_id=eq.${testBookingId}`
          }, 
          () => {
            fetchEmailLogs();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [testBookingId]);

  const testWorkerEmail = async (bookingId?: string) => {
    try {
      const useBookingId = bookingId || testBookingId;
      if (!useBookingId) {
        throw new Error('No booking ID available. Please create a test booking first.');
      }

      console.log('Testing worker assignment email...', { 
        bookingId: useBookingId, 
        workerId: ANKIT_WORKER_ID,
        workerEmail 
      });
      
      const { data, error } = await supabase.functions.invoke('send-worker-assignment-notification', {
        body: { 
          bookingId: useBookingId, 
          workerId: ANKIT_WORKER_ID 
        }
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
        workerEmail: { success: true, message: `Worker email sent to ${workerEmail}` }
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

  const testCustomerEmail = async (bookingId?: string) => {
    try {
      const useBookingId = bookingId || testBookingId;
      if (!useBookingId) {
        throw new Error('No booking ID available. Please create a test booking first.');
      }

      console.log('Testing customer confirmation email...', { bookingId: useBookingId });
      
      const { data, error } = await supabase.functions.invoke('send-customer-booking-confirmation', {
        body: { bookingId: useBookingId }
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
      // First create a test booking if we don't have one
      let bookingId = testBookingId;
      if (!bookingId) {
        toast({
          title: "Creating Test Booking",
          description: "Creating a test booking for email testing...",
        });
        bookingId = await createTestBooking();
        if (!bookingId) return;
      }

      toast({
        title: "Email Test Started",
        description: "Testing both worker and customer email functionality...",
      });

      // Test worker email
      const workerSuccess = await testWorkerEmail(bookingId);
      
      // Wait a moment before testing customer email
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test customer email
      const customerSuccess = await testCustomerEmail(bookingId);

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

  const sendWorkerEmailToAnkit = async () => {
    setTesting(true);
    try {
      // Create test booking if needed
      let bookingId = testBookingId;
      if (!bookingId) {
        bookingId = await createTestBooking();
        if (!bookingId) return;
      }

      await testWorkerEmail(bookingId);
      
      setTimeout(() => {
        fetchEmailLogs();
      }, 2000);
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
              {/* Test Booking Status */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Test Booking</h4>
                  <Button 
                    onClick={createTestBooking} 
                    disabled={creatingBooking}
                    variant="outline"
                    size="sm"
                  >
                    {creatingBooking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create New
                  </Button>
                </div>
                {testBookingId ? (
                  <div className="text-sm text-muted-foreground">
                    Current booking ID: <code className="bg-background px-1 rounded">{testBookingId}</code>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No test booking created yet</div>
                )}
              </div>

              {/* Worker Email Configuration */}
              <div className="space-y-2">
                <Label htmlFor="worker-email">Worker Email Address</Label>
                <Input 
                  id="worker-email"
                  type="email"
                  value={workerEmail}
                  onChange={(e) => setWorkerEmail(e.target.value)}
                  placeholder="Enter worker email address"
                />
                <div className="text-xs text-muted-foreground">
                  This email will receive the worker assignment notification
                </div>
              </div>

              {/* Quick Test for Ankit */}
              <Button 
                onClick={sendWorkerEmailToAnkit} 
                disabled={testing || creatingBooking}
                className="w-full"
                variant="default"
              >
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Send Worker Email to {workerEmail}
              </Button>
              
              <div className="flex gap-4">
                <Button 
                  onClick={() => testWorkerEmail()} 
                  disabled={testing || !testBookingId}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Test Worker Email
                </Button>
                
                <Button 
                  onClick={() => testCustomerEmail()} 
                  disabled={testing || !testBookingId}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Test Customer Email
                </Button>
              </div>
              
              <Button 
                onClick={runFullEmailTest} 
                disabled={testing || creatingBooking}
                variant="outline"
                className="w-full"
              >
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Run Complete Email Test Suite
              </Button>
              
              {/* Test Results */}
              {Object.keys(testResults).length > 0 && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium">Test Results:</h4>
                  {testResults.bookingCreation && (
                    <div className="flex items-center gap-2">
                      {testResults.bookingCreation.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">Booking Creation: {testResults.bookingCreation.message}</span>
                    </div>
                  )}
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
                  {testBookingId ? 'No email logs found for test booking' : 'Create a test booking to see email logs'}
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