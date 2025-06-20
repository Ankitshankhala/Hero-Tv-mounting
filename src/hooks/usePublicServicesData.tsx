
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  duration_minutes: number;
  image_url: string | null;
  sort_order: number;
}

export const usePublicServicesData = () => {
  const [services, setServices] = useState<PublicService[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('id, name, description, base_price, duration_minutes, image_url, sort_order')
        .eq('is_active', true)
        .eq('is_visible', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching public services:', error);
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return {
    services,
    loading,
    refetch: fetchServices
  };
};
