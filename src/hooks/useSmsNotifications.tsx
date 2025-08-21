import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSmsNotifications = () => {
  const { toast } = useToast();

  const sendWorkerAssignmentSms = async (bookingId: string) => {
    try {
      console.log('Sending SMS notification for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('send-sms-notification', {
        body: { bookingId }
      });

      if (error) {
        console.error('Error sending SMS:', error);
        // Don't show error toast to avoid disrupting user experience
        // Just log it for admin monitoring
        return false;
      }

      console.log('SMS sent successfully:', data);
      return true;
    } catch (error) {
      console.error('Failed to send SMS notification:', error);
      return false;
    }
  };

  const resendWorkerSms = async (bookingId: string) => {
    try {
      console.log('Resending SMS notification for booking:', bookingId);
      
      // Call the database function to manually resend SMS
      const { data, error } = await supabase.rpc('resend_worker_sms', {
        booking_id_param: bookingId
      });

      if (error) {
        console.error('Error resending SMS:', error);
        toast({
          title: "SMS Error",
          description: "Failed to resend SMS notification",
          variant: "destructive",
        });
        return false;
      }

      console.log('SMS resend triggered:', data);
      toast({
        title: "SMS Sent",
        description: "SMS notification resent to worker",
      });
      return true;
    } catch (error) {
      console.error('Failed to resend SMS notification:', error);
      toast({
        title: "SMS Error", 
        description: "Failed to resend SMS notification",
        variant: "destructive",
      });
      return false;
    }
  };

  const resendWorkerEmail = async (bookingId: string, options?: { force?: boolean }) => {
    try {
      console.log('Resending email notification for booking:', bookingId);

      // Fetch the assigned worker_id for this booking
      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .select('worker_id')
        .eq('id', bookingId)
        .single();

      if (bookingErr || !booking?.worker_id) {
        console.error('No worker assigned to booking or fetch failed', bookingErr);
        toast({
          title: 'Email Error',
          description: 'Cannot resend worker email: no worker assigned yet.',
          variant: 'destructive',
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('send-worker-assignment-notification', {
        body: { 
          bookingId, 
          workerId: booking.worker_id,
          force: options?.force || false
        }
      });

      if (error) {
        console.error('Error resending email:', error);
        toast({
          title: 'Email Error',
          description: 'Failed to resend email notification',
          variant: 'destructive',
        });
        return false;
      }

      console.log('Email resend triggered:', data);
      toast({
        title: 'Email Sent',
        description: options?.force ? 'Worker email force resent successfully' : 'Email notification resent to worker',
      });
      return true;
    } catch (error) {
      console.error('Failed to resend email notification:', error);
      toast({
        title: 'Email Error',
        description: 'Failed to resend email notification',
        variant: 'destructive',
      });
      return false;
    }
  };

  const resendCustomerEmail = async (bookingId: string) => {
    try {
      console.log('Resending customer confirmation email for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('send-customer-booking-confirmation', {
        body: { bookingId }
      });

      if (error) {
        console.error('Error resending customer email:', error);
        toast({
          title: "Email Error",
          description: "Failed to resend customer email",
          variant: "destructive",
        });
        return false;
      }

      console.log('Customer email resend triggered:', data);
      toast({
        title: "Email Sent",
        description: "Customer confirmation email resent successfully",
      });
      return true;
    } catch (error) {
      console.error('Failed to resend customer email:', error);
      toast({
        title: "Email Error", 
        description: "Failed to resend customer email",
        variant: "destructive",
      });
      return false;
    }
  };

  const getSmsLogs = async (bookingId?: string) => {
    try {
      let query = supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingId) {
        query = query.eq('booking_id', bookingId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching SMS logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch SMS logs:', error);
      return [];
    }
  };

  const getEmailLogs = async (bookingId?: string) => {
    try {
      let query = supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingId) {
        query = query.eq('booking_id', bookingId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching email logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch email logs:', error);
      return [];
    }
  };

  return {
    sendWorkerAssignmentSms,
    resendWorkerSms,
    resendWorkerEmail,
    resendCustomerEmail,
    getSmsLogs,
    getEmailLogs
  };
};