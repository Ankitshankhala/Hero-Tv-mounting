import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackServicesArray } from '@/constants/fallbackServices';

const CACHE_KEY = 'services_cache_v2';
const MAX_AGE = 5 * 60 * 1000;
const CACHE_TTL = MAX_AGE; // backwards-compat alias

interface CachedService {
  id: string;
  name: string;
  base_price: number | null;
  description?: string | null;
  duration_minutes?: number | null;
  is_active: boolean | null;
  is_visible: boolean;
  pricing_config?: any;
  sort_order?: number;
  image_url?: string | null;
  created_at?: string | null;
}

interface CacheData {
  data: CachedService[];
  cached_at: number;
}

interface ServicesCacheContextValue {
  allServices: CachedService[];
  publicServices: CachedService[];
  isLoading: boolean;
  isFromCache: boolean;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  invalidateCache: () => void;
}

const ServicesCacheContext = createContext<ServicesCacheContextValue | null>(null);

// Read cache from localStorage. Returns the parsed entry (with stale flag) or null.
const readCache = (): { data: CachedService[]; cached_at: number; isStale: boolean } | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Support both new ({ data, cached_at }) and legacy ({ services, timestamp }) shapes
    const data: CachedService[] = parsed.data || parsed.services;
    const cached_at: number = parsed.cached_at || parsed.timestamp || 0;
    if (!Array.isArray(data)) return null;
    return { data, cached_at, isStale: Date.now() - cached_at >= MAX_AGE };
  } catch {
    return null;
  }
};

// Write cache to localStorage in the new shape: { data, cached_at }
const writeCache = (services: CachedService[]) => {
  try {
    const payload: CacheData = { data: services, cached_at: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore localStorage errors
  }
};

// Clear cache from localStorage
const clearCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore localStorage errors
  }
};

export const ServicesCacheProvider = ({ children }: { children: ReactNode }) => {
  const [allServices, setAllServices] = useState<CachedService[]>(() => {
    // Initialize with cache or fallback immediately
    const cached = readCache();
    return cached?.services || getFallbackServicesArray();
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      if (data && data.length > 0) {
        setAllServices(data);
        setIsFromCache(false);
        setLastUpdated(new Date());
        writeCache(data);
      }
    } catch (error) {
      console.warn('[ServicesCacheContext] Failed to fetch services:', error);
      // Keep using cached/fallback data
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Explicitly invalidate cache and refetch
  const invalidateCache = useCallback(() => {
    console.log('[ServicesCacheContext] Cache invalidated, refetching...');
    clearCache();
    fetchServices();
  }, [fetchServices]);

  // Fetch on mount with background refresh
  useEffect(() => {
    // If we have cached data, mark as not loading immediately
    const cached = readCache();
    if (cached?.services) {
      setIsLoading(false);
    }
    
    // Fetch fresh data in background
    fetchServices();
  }, [fetchServices]);

  // Real-time subscription for services table changes
  useEffect(() => {
    const channel = supabase
      .channel('services-realtime-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services'
        },
        (payload) => {
          console.log('[ServicesCacheContext] Services table changed:', payload.eventType);
          clearCache();
          fetchServices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchServices]);

  const publicServices = useMemo(() => {
    return allServices.filter(s => s.is_visible);
  }, [allServices]);

  const value = useMemo(() => ({
    allServices,
    publicServices,
    isLoading,
    isFromCache,
    lastUpdated,
    refetch: fetchServices,
    invalidateCache
  }), [allServices, publicServices, isLoading, isFromCache, lastUpdated, fetchServices, invalidateCache]);

  return (
    <ServicesCacheContext.Provider value={value}>
      {children}
    </ServicesCacheContext.Provider>
  );
};

export const useServicesCache = (): ServicesCacheContextValue => {
  const context = useContext(ServicesCacheContext);
  if (!context) {
    throw new Error('useServicesCache must be used within a ServicesCacheProvider');
  }
  return context;
};
