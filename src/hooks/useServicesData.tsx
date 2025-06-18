
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  image_url: string | null;
}

export const useServicesData = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('id, name, description, base_price, duration_minutes, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Add image_url as null since it doesn't exist in the database
      const servicesWithImageUrl = (data || []).map(service => ({
        ...service,
        image_url: null
      }));
      
      setServices(servicesWithImageUrl);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addService = async (serviceData: {
    name: string;
    description: string;
    base_price: number;
    duration_minutes: number;
    image_url?: string | null;
  }) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .insert([{
          name: serviceData.name,
          description: serviceData.description,
          base_price: serviceData.base_price,
          duration_minutes: serviceData.duration_minutes
        }])
        .select('id, name, description, base_price, duration_minutes, is_active, created_at')
        .single();

      if (error) throw error;

      const serviceWithImageUrl = {
        ...data,
        image_url: null
      };

      setServices(prev => [serviceWithImageUrl, ...prev]);
      toast({
        title: "Success",
        description: "Service added successfully",
      });
      return serviceWithImageUrl;
    } catch (error) {
      console.error('Error adding service:', error);
      toast({
        title: "Error",
        description: "Failed to add service",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateService = async (id: string, serviceData: {
    name: string;
    description: string;
    base_price: number;
    duration_minutes: number;
    image_url?: string | null;
  }) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .update({
          name: serviceData.name,
          description: serviceData.description,
          base_price: serviceData.base_price,
          duration_minutes: serviceData.duration_minutes
        })
        .eq('id', id)
        .select('id, name, description, base_price, duration_minutes, is_active, created_at')
        .single();

      if (error) throw error;

      const serviceWithImageUrl = {
        ...data,
        image_url: null
      };

      setServices(prev => prev.map(service => 
        service.id === id ? serviceWithImageUrl : service
      ));
      toast({
        title: "Success",
        description: "Service updated successfully",
      });
      return serviceWithImageUrl;
    } catch (error) {
      console.error('Error updating service:', error);
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteService = async (id: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setServices(prev => prev.filter(service => service.id !== id));
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return {
    services,
    loading,
    addService,
    updateService,
    deleteService,
    refetch: fetchServices
  };
};
