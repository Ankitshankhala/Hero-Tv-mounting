import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackServicesArray } from '@/constants/fallbackServices';

const CACHE_KEY = 'services_cache_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  services: CachedService[];
  timestamp: number;
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

// Read cache from localStorage
const readCache = (): CacheData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data: CacheData = JSON.parse(cached);
    // Check if cache is still valid
    if (Date.now() - data.timestamp < CACHE_TTL) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
};

// Write cache to localStorage
const writeCache = (services: CachedService[]) => {
  try {
    const data: CacheData = {
      services,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
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
