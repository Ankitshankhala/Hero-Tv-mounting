import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SmsLogData {
  id: string;
  recipient_number: string;
  recipient_name: string | null;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  created_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  twilio_sid: string | null;
  booking_id: string | null;
  sms_type: string | null;
  message_type: string;
}

interface SmsStats {
  sentToday: number;
  deliveryRate: number;
  monthlyTotal: number;
  failedCount: number;
}

export const useSmsLogs = () => {
  const [smsLogs, setSmsLogs] = useState<SmsLogData[]>([]);
  const [stats, setStats] = useState<SmsStats>({
    sentToday: 0,
    deliveryRate: 0,
    monthlyTotal: 0,
    failedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSmsLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch SMS logs - now includes recipient_name field
      const { data: logs, error: logsError } = await supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) {
        throw logsError;
      }

      // Helper function to determine message type from sms_type or content
      const getMessageType = (smsType: string | null, message: string, recipientNumber: string) => {
        // Use sms_type if available
        if (smsType) {
          switch (smsType) {
            case 'worker_assignment': return 'Worker Assignment';
            case 'customer_notification': return 'Customer Notification';
            case 'system_audit': return 'System';
            case 'manual_resend': return 'Manual Resend';
            default: return smsType;
          }
        }
        // Fallback to content-based detection
        if (recipientNumber === 'system' || recipientNumber === 'manual' || recipientNumber === 'trigger') {
          return 'System';
        }
        if (message.includes('New job assigned') || message.includes('Worker assignment') || message.includes('been assigned')) {
          return 'Worker Assignment';
        }
        if (message.includes('booking confirmed') || message.includes('confirmation')) {
          return 'Customer Notification';
        }
        return 'General';
      };

      // Transform data for display
      const transformedLogs: SmsLogData[] = (logs || []).map(log => ({
        id: log.id,
        recipient_number: log.recipient_number,
        recipient_name: log.recipient_name || null,
        message: log.message,
        status: log.status,
        created_at: log.created_at,
        sent_at: log.sent_at,
        error_message: log.error_message,
        twilio_sid: log.twilio_sid,
        booking_id: log.booking_id,
        sms_type: (log as any).sms_type || null,
        message_type: getMessageType((log as any).sms_type, log.message, log.recipient_number)
      }));

      setSmsLogs(transformedLogs);

      // Calculate statistics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const sentToday = transformedLogs.filter(log => {
        const logDate = new Date(log.created_at || '');
        return logDate >= today;
      }).length;

      const monthlyTotal = transformedLogs.filter(log => {
        const logDate = new Date(log.created_at || '');
        return logDate >= monthStart;
      }).length;

      const failedCount = transformedLogs.filter(log => 
        log.status === 'failed'
      ).length;

      const deliveryRate = transformedLogs.length > 0 
        ? ((transformedLogs.length - failedCount) / transformedLogs.length) * 100
        : 0;

      setStats({
        sentToday,
        deliveryRate: Math.round(deliveryRate * 10) / 10,
        monthlyTotal,
        failedCount
      });

    } catch (err) {
      console.error('Error fetching SMS logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch SMS logs');
      toast({
        title: "Error",
        description: "Failed to fetch SMS logs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSmsLogs();

    // Set up real-time subscription for new SMS logs
    const channel = supabase
      .channel('sms-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sms_logs'
        },
        () => {
          // Refetch data when SMS logs change
          fetchSmsLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refetch = () => {
    fetchSmsLogs();
  };

  return {
    smsLogs,
    stats,
    loading,
    error,
    refetch
  };
};