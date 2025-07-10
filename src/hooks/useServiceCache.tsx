import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global cache for services to prevent unnecessary refetches
let servicesCache: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useServiceCache = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const isCacheValid = useMemo(() => {
    return servicesCache && (Date.now() - cacheTimestamp < CACHE_DURATION);
  }, []);

  const fetchServices = async () => {
    if (isCacheValid) {
      setServices(servicesCache!);
      return servicesCache!;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .eq('is_visible', true)
        .order('sort_order');

      if (error) throw error;

      // Update cache
      servicesCache = data || [];
      cacheTimestamp = Date.now();
      setServices(servicesCache);
      return servicesCache;
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const invalidateCache = () => {
    servicesCache = null;
    cacheTimestamp = 0;
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return {
    services,
    loading,
    refetchServices: fetchServices,
    invalidateCache
  };
};