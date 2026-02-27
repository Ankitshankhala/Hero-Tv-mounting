import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger, measurePerformance } from '@/utils/logger';

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  duration_minutes: number;
  image_url: string | null;
  sort_order: number;
  pricing_config?: {
    pricing_type?: 'simple' | 'tiered';
    tiers?: Array<{
      quantity: number;
      price: number;
      is_default_for_additional?: boolean;
    }>;
    add_ons?: Record<string, number>;
  } | null;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 10000; // 10 seconds

export const usePublicServicesData = () => {
  const [services, setServices] = useState<PublicService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const fetchServicesWithTimeout = useCallback(async (signal: AbortSignal) => {
    const timeoutId = setTimeout(() => {
      logger.error('[SERVICES] Request timeout after 10s');
    }, REQUEST_TIMEOUT);

    try {
      const { data, error: fetchError } = await supabase
        .from('services')
        .select('id, name, description, base_price, duration_minutes, image_url, sort_order, pricing_config')
        .eq('is_active', true)
        .eq('is_visible', true)
        .order('sort_order', { ascending: true })
        .abortSignal(signal);

      clearTimeout(timeoutId);

      if (fetchError) throw fetchError;
      return data || [];
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }, []);

  const fetchServices = useCallback(async (attempt = 0): Promise<void> => {
    const startTime = performance.now();
    
    try {
      setLoading(true);
      setError(null);
      setRetryCount(attempt);

      logger.dev(`[SERVICES] Fetching services (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);

      const data = await measurePerformance(
        'fetch-public-services',
        () => fetchServicesWithTimeout(abortController.signal)
      );

      clearTimeout(timeoutId);

      const duration = performance.now() - startTime;
      logger.perf('fetch-public-services', duration);

      // Track success metrics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'services_load_success', {
          duration_ms: Math.round(duration),
          service_count: data.length,
          retry_count: attempt
        });
      }

      setServices(data as PublicService[]);
      setLoading(false);
      setError(null);
      
    } catch (err: any) {
      const duration = performance.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errorMessage = isTimeout ? 'Request timeout' : err.message;

      logger.error(`[SERVICES] Fetch failed (attempt ${attempt + 1}): ${errorMessage}`, {
        error: err,
        duration,
        isTimeout
      });

      // Track failure metrics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'services_load_error', {
          error_type: isTimeout ? 'timeout' : 'fetch_error',
          attempt: attempt + 1,
          duration_ms: Math.round(duration)
        });
      }

      // Retry logic with exponential backoff
      if (attempt < MAX_RETRIES) {
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        logger.dev(`[SERVICES] Retrying in ${retryDelay}ms...`);
        
        setTimeout(() => {
          fetchServices(attempt + 1);
        }, retryDelay);
      } else {
        // All retries exhausted
        const finalError = new Error(
          isTimeout 
            ? 'Service loading timeout. Please check your connection.' 
            : 'Unable to load services. Please try again.'
        );
        
        setError(finalError);
        setLoading(false);
        setServices([]); // Explicit empty state
        
        toast({
          title: "Unable to Load Services",
          description: finalError.message,
          variant: "destructive",
        });
      }
    }
  }, [toast, fetchServicesWithTimeout]);

  useEffect(() => {
    fetchServices(0);
  }, [fetchServices]);

  return {
    services,
    loading,
    error,
    retryCount,
    refetch: () => fetchServices(0)
  };
};