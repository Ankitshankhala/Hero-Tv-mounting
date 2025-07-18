import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransactionData {
  booking_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'authorized' | 'captured' | 'refunded';
  payment_intent_id?: string;
  payment_method?: string;
  transaction_type?: 'charge' | 'authorization' | 'capture' | 'refund' | 'void' | 'cash';
  currency?: string;
}

/**
 * Centralized Transaction Manager for Edge Functions
 */
class TransactionManager {
  private supabaseClient: any;

  constructor() {
    this.supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
  }

  async createTransaction(data: TransactionData) {
    try {
      console.log('Creating transaction:', data);

      const transactionData = {
        booking_id: data.booking_id,
        amount: Number(data.amount),
        status: data.status,
        payment_intent_id: data.payment_intent_id,
        payment_method: data.payment_method || 'unknown',
        transaction_type: data.transaction_type || 'charge',
        currency: data.currency || 'USD',
        created_at: new Date().toISOString(),
      };

      const { data: transaction, error } = await this.supabaseClient
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) {
        console.error('Failed to create transaction:', error);
        return { success: false, error: error.message };
      }

      console.log('Transaction created successfully:', transaction.id);
      return { success: true, transaction_id: transaction.id };

    } catch (error: any) {
      console.error('Error in createTransaction:', error);
      return { success: false, error: error.message };
    }
  }

  async findTransactionByPaymentIntent(paymentIntentId: string) {
    try {
      const { data: transaction, error } = await this.supabaseClient
        .from('transactions')
        .select('*')
        .eq('payment_intent_id', paymentIntentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error finding transaction:', error);
        return null;
      }

      return transaction;
    } catch (error) {
      console.error('Error in findTransactionByPaymentIntent:', error);
      return null;
    }
  }

  async updateTransactionByPaymentIntent(paymentIntentId: string, updates: Partial<TransactionData>) {
    try {
      console.log('Updating transaction by payment intent:', paymentIntentId, updates);

      const { data: transaction, error } = await this.supabaseClient
        .from('transactions')
        .update(updates)
        .eq('payment_intent_id', paymentIntentId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update transaction by payment intent:', error);
        return { success: false, error: error.message };
      }

      return { success: true, transaction_id: transaction.id };

    } catch (error: any) {
      console.error('Error in updateTransactionByPaymentIntent:', error);
      return { success: false, error: error.message };
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...data } = await req.json();
    console.log('Payment transaction sync request:', { action, ...data });

    const transactionManager = new TransactionManager();

    let result;

    switch (action) {
      case 'create_authorization':
        result = await transactionManager.createTransaction({
          ...data,
          status: 'authorized',
          transaction_type: 'authorization',
        });
        break;

      case 'create_payment':
        result = await transactionManager.createTransaction({
          ...data,
          status: 'completed',
          transaction_type: 'charge',
        });
        break;

      case 'create_failure':
        result = await transactionManager.createTransaction({
          ...data,
          status: 'failed',
          transaction_type: 'charge',
        });
        break;

      case 'update_to_captured':
        if (!data.payment_intent_id) {
          throw new Error('payment_intent_id required for capture update');
        }
        result = await transactionManager.updateTransactionByPaymentIntent(
          data.payment_intent_id,
          { status: 'completed', transaction_type: 'capture' }
        );
        break;

      case 'create_cash_payment':
        result = await transactionManager.createTransaction({
          ...data,
          status: 'completed',
          transaction_type: 'cash',
          payment_method: 'cash',
        });
        break;

      case 'create_missing_transactions':
        // Create missing transaction records for bookings with payment data but no transactions
        const { data: bookingsWithoutTransactions, error: bookingsError } = await transactionManager.supabaseClient
          .from('bookings')
          .select(`
            id,
            payment_intent_id,
            payment_status,
            service:services(base_price)
          `)
          .not('payment_intent_id', 'is', null)
          .not('payment_status', 'eq', 'pending');

        if (bookingsError) {
          throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
        }

        const createdTransactions = [];
        
        for (const booking of bookingsWithoutTransactions || []) {
          // Check if transaction already exists
          const existingTransaction = await transactionManager.findTransactionByPaymentIntent(booking.payment_intent_id);
          
          if (!existingTransaction) {
            console.log('Creating missing transaction for booking:', booking.id);
            
            let status = 'pending';
            let transactionType = 'charge';
            
            if (booking.payment_status === 'completed') {
              status = 'completed';
            } else if (booking.payment_status === 'authorized') {
              status = 'authorized';
              transactionType = 'authorization';
            } else if (booking.payment_status === 'captured') {
              status = 'completed';
              transactionType = 'capture';
            } else if (booking.payment_status === 'failed') {
              status = 'failed';
            }

            const createResult = await transactionManager.createTransaction({
              booking_id: booking.id,
              amount: booking.service?.base_price || 0,
              status: status as any,
              payment_intent_id: booking.payment_intent_id,
              transaction_type: transactionType as any,
              payment_method: 'card',
            });

            if (createResult.success) {
              createdTransactions.push(createResult.transaction_id);
            }
          }
        }

        result = {
          success: true,
          created_transactions: createdTransactions,
          count: createdTransactions.length,
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in payment transaction sync:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});