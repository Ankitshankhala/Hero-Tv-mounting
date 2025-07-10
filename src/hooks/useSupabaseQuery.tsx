
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRetryableQuery } from '@/hooks/useRetryableQuery';

type TableName = 'users' | 'bookings' | 'onsite_charges' | 'payment_sessions' | 'reviews' | 'services' | 'sms_logs' | 'transactions' | 'worker_availability' | 'worker_notifications' | 'worker_schedule';

interface UseSupabaseQueryOptions {
  table: TableName;
  select?: string;
  filter?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  single?: boolean;
  enabled?: boolean;
}

export const useSupabaseQuery = (options: UseSupabaseQueryOptions) => {
  const { 
    table, 
    select = '*', 
    filter = {}, 
    orderBy, 
    single = false,
    enabled = true 
  } = options;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const { user } = useAuth();
  const { executeWithRetry } = useRetryableQuery();

  const executeQuery = async () => {
    if (!enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await executeWithRetry(async () => {
        // Use a more explicit approach to avoid TypeScript inference issues
        let queryBuilder;
        
        switch (table) {
          case 'users':
            queryBuilder = supabase.from('users').select(select);
            break;
          case 'bookings':
            queryBuilder = supabase.from('bookings').select(select);
            break;
          case 'services':
            queryBuilder = supabase.from('services').select(select);
            break;
          case 'reviews':
            queryBuilder = supabase.from('reviews').select(select);
            break;
          case 'transactions':
            queryBuilder = supabase.from('transactions').select(select);
            break;
          case 'worker_availability':
            queryBuilder = supabase.from('worker_availability').select(select);
            break;
          case 'worker_schedule':
            queryBuilder = supabase.from('worker_schedule').select(select);
            break;
          case 'onsite_charges':
            queryBuilder = supabase.from('onsite_charges').select(select);
            break;
          case 'payment_sessions':
            queryBuilder = supabase.from('payment_sessions').select(select);
            break;
          case 'sms_logs':
            queryBuilder = supabase.from('sms_logs').select(select);
            break;
          case 'worker_notifications':
            queryBuilder = supabase.from('worker_notifications').select(select);
            break;
          default:
            throw new Error(`Unsupported table: ${table}`);
        }

        // Apply filters
        Object.entries(filter).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryBuilder = queryBuilder.eq(key, value);
          }
        });

        // Apply ordering
        if (orderBy) {
          queryBuilder = queryBuilder.order(orderBy.column, { ascending: orderBy.ascending ?? true });
        }

        // Execute query
        const { data: result, error: queryError } = single 
          ? await queryBuilder.maybeSingle()
          : await queryBuilder;

        if (queryError) throw queryError;

        setData(result);
        return result;
      }, `load ${table} data`);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`Query execution error for ${table}:`, err);
      }
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeQuery();
  }, [table, select, JSON.stringify(filter), JSON.stringify(orderBy), single, enabled, user?.id]);

  const refetch = () => {
    executeQuery();
  };

  return { data, loading, error, refetch };
};
