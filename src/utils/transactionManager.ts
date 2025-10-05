import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';

// Types for transaction creation
export interface TransactionData {
  booking_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'authorized' | 'captured' | 'refunded' | 'paid';
  payment_intent_id?: string;
  payment_method?: string;
  transaction_type?: 'charge' | 'authorization' | 'capture' | 'refund' | 'void' | 'cash';
  currency?: string;
}

export interface PaymentOperationResult {
  success: boolean;
  transaction_id?: string;
  error?: string;
}

/**
 * Centralized Transaction Manager
 * Ensures every payment operation creates a proper transaction record
 */
export class TransactionManager {
  private supabaseClient: any;
  private useServiceRole: boolean;

  constructor(useServiceRole = false) {
    this.useServiceRole = useServiceRole;
    if (useServiceRole) {
      // Use service role client for edge functions
      this.supabaseClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        { auth: { persistSession: false } }
      );
    } else {
      // Use regular client for frontend
      this.supabaseClient = supabase;
    }
  }

  /**
   * Create a transaction record
   */
  async createTransaction(data: TransactionData): Promise<PaymentOperationResult> {
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

  /**
   * Update an existing transaction
   */
  async updateTransaction(
    transactionId: string, 
    updates: Partial<TransactionData>
  ): Promise<PaymentOperationResult> {
    try {
      console.log('Updating transaction:', transactionId, updates);

      const { data: transaction, error } = await this.supabaseClient
        .from('transactions')
        .update(updates)
        .eq('id', transactionId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update transaction:', error);
        return { success: false, error: error.message };
      }

      return { success: true, transaction_id: transaction.id };

    } catch (error: any) {
      console.error('Error in updateTransaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update transaction by payment intent ID
   */
  async updateTransactionByPaymentIntent(
    paymentIntentId: string,
    updates: Partial<TransactionData>
  ): Promise<PaymentOperationResult> {
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

  /**
   * Find transaction by payment intent ID
   */
  async findTransactionByPaymentIntent(paymentIntentId: string) {
    try {
      const { data: transaction, error } = await this.supabaseClient
        .from('transactions')
        .select('*')
        .eq('payment_intent_id', paymentIntentId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error finding transaction:', error);
        return null;
      }

      return transaction;
    } catch (error) {
      console.error('Error in findTransactionByPaymentIntent:', error);
      return null;
    }
  }

  /**
   * Find or create transaction for payment intent
   */
  async findOrCreateTransactionForPaymentIntent(
    paymentIntentId: string,
    bookingId: string,
    amount: number,
    initialStatus: TransactionData['status'] = 'pending'
  ): Promise<PaymentOperationResult> {
    try {
      // First try to find existing transaction
      const existingTransaction = await this.findTransactionByPaymentIntent(paymentIntentId);
      
      if (existingTransaction) {
        console.log('Found existing transaction:', existingTransaction.id);
        return { success: true, transaction_id: existingTransaction.id };
      }

      // Create new transaction if not found
      return await this.createTransaction({
        booking_id: bookingId,
        amount: amount,
        status: initialStatus,
        payment_intent_id: paymentIntentId,
        transaction_type: 'authorization',
        payment_method: 'card',
      });

    } catch (error: any) {
      console.error('Error in findOrCreateTransactionForPaymentIntent:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record payment authorization
   */
  async recordAuthorization(data: TransactionData): Promise<PaymentOperationResult> {
    const authData = {
      ...data,
      status: 'authorized' as const,
      transaction_type: 'authorization' as const,
    };
    return await this.createTransaction(authData);
  }

  /**
   * Record payment capture
   */
  async recordCapture(paymentIntentId: string, amount?: number): Promise<PaymentOperationResult> {
    try {
      // Find the authorization transaction
      const authTransaction = await this.findTransactionByPaymentIntent(paymentIntentId);
      
      if (authTransaction) {
        // Update existing transaction to captured
        return await this.updateTransaction(authTransaction.id, {
          status: 'completed',
          transaction_type: 'capture',
        });
      } else {
        // Create new capture transaction if authorization not found
        return await this.createTransaction({
          booking_id: '', // Will be filled by caller
          amount: amount || 0,
          status: 'completed',
          payment_intent_id: paymentIntentId,
          transaction_type: 'capture',
          payment_method: 'card',
        });
      }
    } catch (error: any) {
      console.error('Error in recordCapture:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record payment failure
   */
  async recordFailure(data: TransactionData): Promise<PaymentOperationResult> {
    const failureData = {
      ...data,
      status: 'failed' as const,
    };
    return await this.createTransaction(failureData);
  }

  /**
   * Record cash payment
   */
  async recordCashPayment(data: Omit<TransactionData, 'payment_intent_id' | 'transaction_type' | 'status'>): Promise<PaymentOperationResult> {
    const cashData = {
      ...data,
      status: 'paid' as const, // Use 'paid' to match status mapping
      transaction_type: 'charge' as const, // Use 'charge' instead of 'cash'
      payment_method: 'cash',
    };
    return await this.createTransaction(cashData);
  }

  /**
   * Sync booking payment status with latest transaction
   */
  async syncBookingPaymentStatus(bookingId: string): Promise<PaymentOperationResult> {
    try {
      // Get latest transaction for booking
      const { data: latestTransaction, error: transactionError } = await this.supabaseClient
        .from('transactions')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (transactionError) {
        console.error('No transactions found for booking:', bookingId);
        return { success: false, error: 'No transactions found' };
      }

      // Map transaction status to booking payment status
      let bookingPaymentStatus = 'pending';
      let bookingStatus = 'pending';

      switch (latestTransaction.status) {
        case 'completed':
        case 'captured':
          bookingPaymentStatus = 'captured';
          // Only set to confirmed if not already in a later status
          // Workers manually mark as completed after finishing work
          bookingStatus = 'confirmed';
          break;
        case 'authorized':
          bookingPaymentStatus = 'authorized';
          bookingStatus = 'payment_authorized';
          break;
        case 'failed':
          bookingPaymentStatus = 'failed';
          bookingStatus = 'pending';
          break;
        default:
          bookingPaymentStatus = 'pending';
          bookingStatus = 'pending';
      }

      // Update booking
      const { error: updateError } = await this.supabaseClient
        .from('bookings')
        .update({
          payment_status: bookingPaymentStatus,
          status: bookingStatus,
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Failed to update booking status:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('Booking payment status synced successfully');
      return { success: true };

    } catch (error: any) {
      console.error('Error in syncBookingPaymentStatus:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export convenience functions for common operations
export const createTransaction = async (data: TransactionData) => {
  const manager = new TransactionManager();
  return await manager.createTransaction(data);
};

export const recordCashPayment = async (data: Omit<TransactionData, 'payment_intent_id' | 'transaction_type' | 'status'>) => {
  const manager = new TransactionManager();
  return await manager.recordCashPayment(data);
};

export const syncBookingPaymentStatus = async (bookingId: string) => {
  const manager = new TransactionManager();
  return await manager.syncBookingPaymentStatus(bookingId);
};