import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeInvoices = (onInvoiceUpdate?: () => void) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Set up real-time subscription for invoice changes
    const channel = supabase
      .channel('invoice-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invoices'
        },
        (payload) => {
          console.log('New invoice created:', payload);
          onInvoiceUpdate?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoices'
        },
        (payload) => {
          console.log('Invoice updated:', payload);
          onInvoiceUpdate?.();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log('Real-time invoice subscription active');
        }
      });

    return () => {
      setIsConnected(false);
      supabase.removeChannel(channel);
    };
  }, [onInvoiceUpdate]);

  return { isConnected };
};