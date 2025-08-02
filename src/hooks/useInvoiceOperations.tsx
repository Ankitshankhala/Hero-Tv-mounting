
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
// Email functionality removed

export const useInvoiceOperations = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  // Email functionality removed

  const generateInvoice = async (bookingId: string, sendEmail = false) => {
    setLoading(true);
    try {
      // Generate invoice without automatic email sending
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { 
          booking_id: bookingId,
          send_email: false // Always disable automatic email, we'll handle it separately
        }
      });

      if (error) throw error;

      // Email functionality removed - invoice generated without email
      toast({
        title: "Success",
        description: "Invoice generated successfully",
      });

      return data;
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to generate invoice",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async (customerId?: string) => {
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          customer:users!invoices_customer_id_fkey(name, email, phone),
          booking:bookings!invoices_booking_id_fkey(
            scheduled_date,
            service:services(name)
          ),
          invoice_items(*)
        `)
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
      return [];
    }
  };

  return {
    generateInvoice,
    fetchInvoices,
    loading
  };
};
