import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Send, CheckCircle, AlertCircle, Clock, Search } from 'lucide-react';

export const EmailNotificationManager = () => {
  const [bookingId, setBookingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentEmails, setRecentEmails] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const { toast } = useToast();

  const validateUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const sendTestEmail = async (emailType: 'confirmation' | 'reminder') => {
    if (!bookingId) {
      toast({
        title: "Error",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    if (!validateUUID(bookingId)) {
      toast({
        title: "Invalid Booking ID",
        description: "Please enter a valid UUID format (e.g. 11d71f72-1c1c-4b40-84fd-04817e774831)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const functionName = emailType === 'confirmation' 
        ? 'send-customer-booking-confirmation-email' 
        : 'send-payment-reminder-email';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { bookingId }
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: `${emailType === 'confirmation' ? 'Booking confirmation' : 'Payment reminder'} email sent successfully`,
      });

      // Refresh email logs
      fetchRecentEmails();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendOrchestrated = async () => {
    if (!bookingId) {
      toast({
        title: "Error",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    if (!validateUUID(bookingId)) {
      toast({
        title: "Invalid Booking ID",
        description: "Please enter a valid UUID format (e.g. 11d71f72-1c1c-4b40-84fd-04817e774831)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-notification-orchestrator', {
        body: { bookingId, trigger: 'manual' }
      });

      if (error) throw error;

      toast({
        title: "Smart Email Sent",
        description: data.message || "Email orchestrator executed successfully",
      });

      // Refresh email logs
      fetchRecentEmails();
    } catch (error) {
      console.error('Error with orchestrated email:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send orchestrated email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runWatchdog = async () => {
    if (!bookingId) {
      toast({
        title: "Error",
        description: "Please enter a booking ID",
        variant: "destructive",
      });
      return;
    }

    if (!validateUUID(bookingId)) {
      toast({
        title: "Invalid Booking ID",
        description: "Please enter a valid UUID format",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('booking-notification-watchdog', {
        body: { bookingId }
      });

      if (error) throw error;

      const actions = data.actions || [];
      const message = actions.length > 0 
        ? `Watchdog completed: ${actions.join(', ')}`
        : 'Watchdog check completed - no missing emails detected';

      toast({
        title: "Watchdog Completed",
        description: message,
      });

      // Refresh email logs
      fetchRecentEmails();
    } catch (error) {
      console.error('Error running watchdog:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run watchdog",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentEmails(data || []);
    } catch (error) {
      console.error('Error fetching email logs:', error);
    }
  };

  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, guest_customer_info, scheduled_date, scheduled_start, payment_status, status')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchRecentEmails();
    fetchBookings();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notification System
          </CardTitle>
          <CardDescription>
            Test and manage the two-stage email notification system for bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Booking ID (UUID format)"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="flex-1"
              />
              <Button onClick={fetchBookings} variant="outline" disabled={loadingBookings}>
                <Search className="h-4 w-4 mr-2" />
                Find Bookings
              </Button>
              <Button onClick={fetchRecentEmails} variant="outline">
                Refresh Logs
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Or select a recent booking:</label>
              <Select value={bookingId} onValueChange={setBookingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a booking..." />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((booking) => {
                    const customerName = booking.guest_customer_info?.name || 'Unknown Customer';
                    const date = new Date(booking.scheduled_date).toLocaleDateString();
                    const shortId = booking.id.slice(-8).toUpperCase();
                    return (
                      <SelectItem key={booking.id} value={booking.id}>
                        #{shortId} - {customerName} ({date}) - {booking.payment_status}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Button
              onClick={() => sendTestEmail('confirmation')}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send Confirmation Email
            </Button>

            <Button
              onClick={() => sendTestEmail('reminder')}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send Payment Reminder
            </Button>

            <Button
              onClick={sendOrchestrated}
              disabled={isLoading}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Smart Email (Auto-detect)
            </Button>

            <Button
              onClick={runWatchdog}
              disabled={isLoading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Run Watchdog
            </Button>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Email System Overview:</h4>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><strong>Stage 1 (Confirmation):</strong> Sent when payment is authorized AND worker is assigned</p>
              <p><strong>Stage 2 (Reminder):</strong> Sent when booking exists but payment is incomplete</p>
              <p><strong>Smart Email:</strong> Automatically detects which stage and sends appropriate email</p>
              <p><strong>Watchdog:</strong> Checks if emails were sent and resends missing ones with idempotency protection</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Email Logs</CardTitle>
          <CardDescription>
            Latest email notifications sent from the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentEmails.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No email logs found. Click "Refresh Logs" to load recent emails.
            </p>
          ) : (
            <div className="space-y-3">
              {recentEmails.map((email) => (
                <div key={email.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(email.status)}
                      <span className="font-medium">{email.subject}</span>
                      <Badge variant={email.status === 'sent' ? 'default' : 'destructive'}>
                        {email.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      To: {email.recipient_email}
                    </p>
                    {email.error_message && (
                      <p className="text-sm text-red-500 mt-1">{email.error_message}</p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(email.created_at).toLocaleString()}
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