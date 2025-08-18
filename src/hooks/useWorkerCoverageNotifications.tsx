
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface CoverageNotification {
  id: string;
  booking_id: string;
  notification_type: string;
  sent_at: string;
  response: string | null;
  distance_priority: number;
  booking?: {
    scheduled_date: string;
    scheduled_start: string;
    location_notes: string;
    customer?: {
      name: string;
      city: string;
    };
    service?: {
      name: string;
      base_price: number;
    };
  };
}

export const useWorkerCoverageNotifications = () => {
  const [notifications, setNotifications] = useState<CoverageNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('worker_coverage_notifications')
        .select(`
          *,
          booking:bookings!booking_id(
            *,
            customer:users!customer_id(name, city),
            service:services!service_id(name, base_price)
          )
        `)
        .eq('worker_id', user.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching coverage notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load coverage notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const respondToNotification = async (notificationId: string, response: 'accepted' | 'declined') => {
    try {
      const { data, error } = await supabase.rpc('respond_to_coverage_request', {
        p_notification_id: notificationId,
        p_response: response
      });

      if (error) throw error;

      // Refresh notifications
      await fetchNotifications();

      if (response === 'accepted') {
        if (data) {
          toast({
            title: "Success!",
            description: "You've been assigned to this job",
          });
        } else {
          toast({
            title: "Job Already Taken",
            description: "This job was already assigned to another worker",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Response Recorded",
          description: "Thank you for your response",
        });
      }

      return data;
    } catch (error) {
      console.error('Error responding to notification:', error);
      toast({
        title: "Error",
        description: "Failed to respond to notification",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getPendingNotifications = () => {
    return notifications.filter(n => !n.response);
  };

  const getNotificationsByResponse = (response: string) => {
    return notifications.filter(n => n.response === response);
  };

  useEffect(() => {
    fetchNotifications();

    // Set up real-time subscription for new notifications and updates
    if (user) {
      const channel = supabase
        .channel(`worker-coverage-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'worker_coverage_notifications',
            filter: `worker_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
            toast({
              title: "New Coverage Request",
              description: "You have a new job coverage request",
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'worker_coverage_notifications',
            filter: `worker_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    notifications,
    loading,
    respondToNotification,
    getPendingNotifications,
    getNotificationsByResponse,
    refetch: fetchNotifications
  };
};
