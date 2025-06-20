
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
        .select('id, name, description, base_price, duration_minutes, is_active, created_at, image_url')
        .eq('is_active', true)
        .order('name', { ascending: true }); // Changed to order by name alphabetically

      if (error) throw error;
      
      setServices(data || []);
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
          duration_minutes: serviceData.duration_minutes,
          image_url: serviceData.image_url
        }])
        .select('id, name, description, base_price, duration_minutes, is_active, created_at, image_url')
        .single();

      if (error) throw error;

      setServices(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Service added successfully",
      });
      return data;
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
          duration_minutes: serviceData.duration_minutes,
          image_url: serviceData.image_url
        })
        .eq('id', id)
        .select('id, name, description, base_price, duration_minutes, is_active, created_at, image_url')
        .single();

      if (error) throw error;

      setServices(prev => prev.map(service => 
        service.id === id ? data : service
      ));
      toast({
        title: "Success",
        description: "Service updated successfully",
      });
      return data;
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
