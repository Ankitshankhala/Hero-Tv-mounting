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

  return {
    sendWorkerAssignmentSms
  };
};