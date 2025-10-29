import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SavedPaymentMethod {
  id: string;
  email: string;
  stripe_customer_id: string;
  stripe_default_payment_method_id: string;
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
}

export const useSavedPaymentMethods = (customerEmail?: string) => {
  const [paymentMethod, setPaymentMethod] = useState<SavedPaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchPaymentMethod = async (email: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stripe_customers')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          throw error;
        }
        setPaymentMethod(null);
        return null;
      }

      // Fetch card details from Stripe via edge function
      if (data.stripe_default_payment_method_id) {
        const { data: cardDetails } = await supabase.functions.invoke('get-payment-method-details', {
          body: { paymentMethodId: data.stripe_default_payment_method_id }
        });

        if (cardDetails) {
          setPaymentMethod({
            ...data,
            last4: cardDetails.last4,
            brand: cardDetails.brand,
            exp_month: cardDetails.exp_month,
            exp_year: cardDetails.exp_year,
          });
          return {
            ...data,
            last4: cardDetails.last4,
            brand: cardDetails.brand,
            exp_month: cardDetails.exp_month,
            exp_year: cardDetails.exp_year,
          };
        }
      }

      setPaymentMethod(data);
      return data;
    } catch (error) {
      console.error('Error fetching payment method:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const chargeSavedMethod = async (bookingId: string, amount: number, notes?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('charge-saved-payment-method', {
        body: {
          bookingId,
          amount,
          notes
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to charge payment method');
      }

      if (!data.success) {
        throw new Error(data.error || 'Payment failed');
      }

      toast({
        title: "Payment Successful",
        description: `Successfully charged $${amount.toFixed(2)}`,
      });

      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to charge payment method';
      console.error('Error charging saved method:', error);
      
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const removePaymentMethod = async (customerId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('stripe_customers')
        .update({
          stripe_default_payment_method_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (error) throw error;

      toast({
        title: "Payment Method Removed",
        description: "Your payment method has been removed successfully.",
      });

      setPaymentMethod(null);
      return { success: true };
    } catch (error) {
      console.error('Error removing payment method:', error);
      toast({
        title: "Error",
        description: "Failed to remove payment method",
        variant: "destructive",
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerEmail) {
      fetchPaymentMethod(customerEmail);
    }
  }, [customerEmail]);

  return {
    paymentMethod,
    loading,
    fetchPaymentMethod,
    chargeSavedMethod,
    removePaymentMethod,
  };
};
