
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type TableName = 'users' | 'bookings' | 'invoice_modifications' | 'on_site_charges' | 'payment_sessions' | 'reviews' | 'services' | 'sms_logs' | 'transactions' | 'worker_applications' | 'worker_availability' | 'worker_schedules';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const executeQuery = async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

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
        case 'worker_applications':
          queryBuilder = supabase.from('worker_applications').select(select);
          break;
        case 'worker_availability':
          queryBuilder = supabase.from('worker_availability').select(select);
          break;
        case 'worker_schedules':
          queryBuilder = supabase.from('worker_schedules').select(select);
          break;
        case 'invoice_modifications':
          queryBuilder = supabase.from('invoice_modifications').select(select);
          break;
        case 'on_site_charges':
          queryBuilder = supabase.from('on_site_charges').select(select);
          break;
        case 'payment_sessions':
          queryBuilder = supabase.from('payment_sessions').select(select);
          break;
        case 'sms_logs':
          queryBuilder = supabase.from('sms_logs').select(select);
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

      if (queryError) {
        console.error('Supabase query error:', queryError);
        
        // Handle specific RLS errors
        if (queryError.message?.includes('row-level security policy')) {
          setError('You don\'t have permission to access this data');
          toast({
            title: "Access Denied",
            description: "You don't have permission to view this data",
            variant: "destructive",
          });
        } else {
          setError(queryError.message);
          toast({
            title: "Error",
            description: queryError.message,
            variant: "destructive",
          });
        }
        return;
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Query execution error:', err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
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
