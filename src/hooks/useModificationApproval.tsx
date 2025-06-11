
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export const useModificationApproval = () => {
  const [pendingModifications, setPendingModifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPendingModifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('invoice_modifications')
        .select(`
          *,
          booking:bookings(id, customer_id, scheduled_at, customer_address)
        `)
        .eq('approval_status', 'pending')
        .eq('booking.customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Mark modifications as viewed when customer opens them
      if (data && data.length > 0) {
        const modificationIds = data
          .filter(mod => !mod.customer_viewed_at)
          .map(mod => mod.id);

        if (modificationIds.length > 0) {
          await supabase
            .from('invoice_modifications')
            .update({ customer_viewed_at: new Date().toISOString() })
            .in('id', modificationIds);
        }
      }

      setPendingModifications(data || []);
    } catch (error) {
      console.error('Error fetching pending modifications:', error);
      toast({
        title: "Error",
        description: "Failed to load pending modifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingModifications();

    // Set up real-time subscription for new modifications
    if (user) {
      const channel = supabase
        .channel('modification-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'invoice_modifications',
          },
          () => {
            fetchPendingModifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    pendingModifications,
    loading,
    refetch: fetchPendingModifications,
  };
};
