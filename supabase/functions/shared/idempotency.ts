// Shared idempotency utilities for production-grade duplicate prevention

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface IdempotencyRecord {
  id: string;
  idempotency_key: string;
  operation_type: 'booking_create' | 'payment_intent' | 'payment_confirm';
  request_hash: string;
  response_data: any;
  status: 'pending' | 'completed' | 'failed';
  user_id: string;
  created_at: string;
  expires_at: string;
}

export class IdempotencyManager {
  private supabase: any;

  constructor(supabaseServiceRoleKey: string) {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseServiceRoleKey,
      { auth: { persistSession: false } }
    );
  }

  // Generate a deterministic hash for request deduplication
  generateRequestHash(data: any): string {
    const sortedData = JSON.stringify(data, Object.keys(data).sort());
    return btoa(sortedData);
  }

  // Generate secure idempotency key
  generateIdempotencyKey(prefix: string, userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 12);
    return `${prefix}_${userId}_${timestamp}_${random}`;
  }

  // Check if operation already exists
  async checkIdempotency(
    idempotencyKey: string,
    operationType: string,
    requestHash: string,
    userId: string
  ): Promise<{ exists: boolean; record?: IdempotencyRecord }> {
    try {
      const { data, error } = await this.supabase
        .from('idempotency_records')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .eq('operation_type', operationType)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      if (data) {
        // Check if record is expired
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
          await this.cleanupExpiredRecord(data.id);
          return { exists: false };
        }

        // Check if request hash matches (exact duplicate)
        if (data.request_hash === requestHash && data.user_id === userId) {
          return { exists: true, record: data };
        }

        // Same idempotency key but different request - this is an error
        throw new Error('Idempotency key reused with different request data');
      }

      return { exists: false };
    } catch (error) {
      console.error('Error checking idempotency:', error);
      throw error;
    }
  }

  // Store idempotency record
  async storeIdempotencyRecord(
    idempotencyKey: string,
    operationType: string,
    requestHash: string,
    userId: string,
    ttlMinutes: number = 60
  ): Promise<string> {
    try {
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      const { data, error } = await this.supabase
        .from('idempotency_records')
        .insert({
          idempotency_key: idempotencyKey,
          operation_type: operationType,
          request_hash: requestHash,
          user_id: userId,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
          response_data: null
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('Error storing idempotency record:', error);
      throw error;
    }
  }

  // Update idempotency record with result
  async updateIdempotencyRecord(
    recordId: string,
    status: 'completed' | 'failed',
    responseData: any
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('idempotency_records')
        .update({
          status,
          response_data: responseData
        })
        .eq('id', recordId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating idempotency record:', error);
      // Don't throw here - this is not critical for main operation
    }
  }

  // Cleanup expired record
  async cleanupExpiredRecord(recordId: string): Promise<void> {
    try {
      await this.supabase
        .from('idempotency_records')
        .delete()
        .eq('id', recordId);
    } catch (error) {
      console.error('Error cleaning up expired record:', error);
      // Non-critical error
    }
  }

  // Cleanup all expired records (for scheduled task)
  async cleanupExpiredRecords(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('idempotency_records')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        throw error;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error during bulk cleanup:', error);
      return 0;
    }
  }
}

// Convenience function for edge functions
export async function withIdempotency<T>(
  idempotencyKey: string,
  operationType: string,
  requestData: any,
  userId: string,
  operation: () => Promise<T>,
  ttlMinutes: number = 60
): Promise<T> {
  const manager = new IdempotencyManager(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  
  const requestHash = manager.generateRequestHash(requestData);
  
  // Check if operation already exists
  const { exists, record } = await manager.checkIdempotency(
    idempotencyKey,
    operationType,
    requestHash,
    userId
  );

  if (exists && record) {
    if (record.status === 'completed') {
      console.log(`Returning cached result for idempotency key: ${idempotencyKey}`);
      return record.response_data;
    } else if (record.status === 'failed') {
      throw new Error('Previous attempt failed - please use a new idempotency key');
    } else {
      throw new Error('Operation is still in progress');
    }
  }

  // Store new idempotency record
  const recordId = await manager.storeIdempotencyRecord(
    idempotencyKey,
    operationType,
    requestHash,
    userId,
    ttlMinutes
  );

  try {
    // Execute the operation
    const result = await operation();
    
    // Update record with success
    await manager.updateIdempotencyRecord(recordId, 'completed', result);
    
    return result;
  } catch (error) {
    // Update record with failure
    const errorMessage = error instanceof Error ? error.message : String(error);
    await manager.updateIdempotencyRecord(recordId, 'failed', { error: errorMessage });
    throw error;
  }
}