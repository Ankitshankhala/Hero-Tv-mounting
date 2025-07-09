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

  return {
    sendWorkerAssignmentSms,
    resendWorkerSms,
    getSmsLogs
  };
};