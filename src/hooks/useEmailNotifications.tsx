import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailNotificationParams {
  bookingId: string;
  type: 'worker_assignment' | 'customer_confirmation' | 'invoice_final';
  skipIdempotencyCheck?: boolean;
}

export const useEmailNotifications = () => {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const sendEmailNotification = async ({ 
    bookingId, 
    type, 
    skipIdempotencyCheck = false 
  }: EmailNotificationParams): Promise<boolean> => {
    setSending(true);
    
    try {
      // Check for recent duplicate emails unless skipped
      if (!skipIdempotencyCheck) {
        const { data: recentEmail } = await supabase
          .from('email_logs')
          .select('id')
          .eq('booking_id', bookingId)
          .ilike('subject', `%${type}%`)
          .eq('status', 'sent')
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 minutes
          .limit(1);

        if (recentEmail && recentEmail.length > 0) {
          console.log(`Skipping duplicate ${type} email for booking ${bookingId}`);
          return true;
        }
      }

      let edgeFunctionName: string;
      let successMessage: string;

      switch (type) {
        case 'worker_assignment':
          edgeFunctionName = 'send-worker-assignment-email';
          successMessage = 'Worker assignment email sent';
          break;
        case 'customer_confirmation':
          edgeFunctionName = 'send-customer-booking-confirmation-email';
          successMessage = 'Customer confirmation email sent';
          break;
        case 'invoice_final':
          edgeFunctionName = 'send-final-invoice-email';
          successMessage = 'Final invoice email sent';
          break;
        default:
          throw new Error(`Unknown email type: ${type}`);
      }

      console.log(`Sending ${type} email for booking ${bookingId}`);

      const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
        body: { bookingId }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Log successful email
      await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: data?.recipient || 'unknown',
        subject: data?.subject || `${type} notification`,
        message: `${type} email sent successfully`,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      console.log(successMessage, data);
      
      toast({
        title: "Email Sent",
        description: successMessage,
      });

      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to send ${type} email`;
      console.error(`Error sending ${type} email:`, error);

      // Log failed email attempt
      await supabase.from('email_logs').insert({
        booking_id: bookingId,
        recipient_email: 'unknown',
        subject: `${type} notification`,
        message: `${type} email failed: ${errorMessage}`,
        status: 'failed',
        error_message: errorMessage,
        sent_at: new Date().toISOString()
      });

      toast({
        title: "Email Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return false;
    } finally {
      setSending(false);
    }
  };

  const sendWorkerAssignmentEmail = async (bookingId: string) => {
    return sendEmailNotification({ bookingId, type: 'worker_assignment' });
  };

  const sendCustomerConfirmationEmail = async (bookingId: string) => {
    return sendEmailNotification({ bookingId, type: 'customer_confirmation' });
  };

  const sendFinalInvoiceEmail = async (bookingId: string) => {
    return sendEmailNotification({ bookingId, type: 'invoice_final' });
  };

  const resendEmail = async (bookingId: string, type: EmailNotificationParams['type']) => {
    return sendEmailNotification({ bookingId, type, skipIdempotencyCheck: true });
  };

  return {
    sendWorkerAssignmentEmail,
    sendCustomerConfirmationEmail,
    sendFinalInvoiceEmail,
    resendEmail,
    sending
  };
};