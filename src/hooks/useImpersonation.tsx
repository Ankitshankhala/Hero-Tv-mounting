import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImpersonationSession {
  session_id: string;
  worker_id: string;
  worker_name: string;
  worker_email: string;
  started_at: string;
}

export const useImpersonation = () => {
  const [activeSession, setActiveSession] = useState<ImpersonationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Check for active impersonation session on mount
  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_impersonation');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setActiveSession(data[0]);
      } else {
        setActiveSession(null);
      }
    } catch (error) {
      console.error('Error checking impersonation session:', error);
    } finally {
      setLoading(false);
    }
  };

  const startImpersonation = async (workerId: string, reason?: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('start_impersonation_session', {
        p_worker_id: workerId,
        p_reason: reason
      });

      if (error) throw error;

      // Refresh active session
      await checkActiveSession();

      toast({
        title: "Impersonation Started",
        description: "You are now viewing as the selected worker.",
      });

      // Navigate to worker dashboard
      window.location.href = '/worker-dashboard';
      
      return true;
    } catch (error: any) {
      console.error('Error starting impersonation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start impersonation session",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const endImpersonation = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.rpc('end_impersonation_session');

      if (error) throw error;

      setActiveSession(null);

      toast({
        title: "Impersonation Ended",
        description: "You have returned to your admin account.",
      });

      // Navigate back to admin panel
      window.location.href = '/admin?tab=workers';
      
      return true;
    } catch (error: any) {
      console.error('Error ending impersonation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to end impersonation session",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    activeSession,
    loading,
    startImpersonation,
    endImpersonation,
    checkActiveSession,
  };
};
