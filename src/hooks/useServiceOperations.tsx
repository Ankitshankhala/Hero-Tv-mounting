
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';
import { useRetryableQuery } from './useRetryableQuery';

export const useServiceOperations = () => {
  const { executeWithRetry } = useRetryableQuery();
  const { handleError } = useErrorHandler();
  const [loading, setLoading] = useState(false);

  const loadServices = async () => {
    try {
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        return data || [];
      }, 'load services');
    } catch (error) {
      handleError(error, 'load services', {
        toastTitle: 'Failed to load services',
        fallbackMessage: 'Unable to load services. Please refresh the page.'
      });
      return [];
    }
  };

  const createService = async (serviceData: any) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('services')
          .insert(serviceData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }, 'create service');
    } catch (error) {
      handleError(error, 'create service', {
        toastTitle: 'Failed to create service',
        fallbackMessage: 'Unable to create service. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateService = async (serviceId: string, serviceData: any) => {
    setLoading(true);
    try {
      return await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', serviceId)
          .select()
          .single();

        if (error) throw error;
        return data;
      }, 'update service');
    } catch (error) {
      handleError(error, 'update service', {
        toastTitle: 'Failed to update service',
        fallbackMessage: 'Unable to update service. Please try again.'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loadServices,
    createService,
    updateService,
    loading
  };
};
