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
  sort_order: number;
  is_visible: boolean;
}

export const useServicesData = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchServices = async () => {
    try {
      setLoading(true);
      // Fetch ALL active services, including non-visible add-ons needed for TV mounting configurations
      const { data, error } = await supabase
        .from('services')
        .select('id, name, description, base_price, duration_minutes, is_active, created_at, image_url, sort_order, is_visible')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

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

  const toggleServiceVisibility = async (serviceId: string) => {
    try {
      const service = services.find(s => s.id === serviceId);
      if (!service) return;

      const newVisibility = !service.is_visible;

      const { error } = await supabase
        .from('services')
        .update({ is_visible: newVisibility })
        .eq('id', serviceId);

      if (error) throw error;

      setServices(prev => prev.map(service => 
        service.id === serviceId 
          ? { ...service, is_visible: newVisibility }
          : service
      ));

      toast({
        title: "Success",
        description: `Service ${newVisibility ? 'shown' : 'hidden'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling service visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update service visibility",
        variant: "destructive",
      });
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
        .select('id, name, description, base_price, duration_minutes, is_active, created_at, image_url, sort_order')
        .single();

      if (error) throw error;

      const serviceWithVisibility = { ...data, is_visible: true };
      setServices(prev => [...prev, serviceWithVisibility].sort((a, b) => a.sort_order - b.sort_order));
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
        .select('id, name, description, base_price, duration_minutes, is_active, created_at, image_url, sort_order')
        .single();

      if (error) throw error;

      setServices(prev => prev.map(service => 
        service.id === id ? { ...data, is_visible: service.is_visible } : service
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

  const updateServiceOrder = async (serviceId: string, newSortOrder: number) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ sort_order: newSortOrder })
        .eq('id', serviceId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating service order:', error);
      throw error;
    }
  };

  const reorderServices = async (reorderedServices: Service[]) => {
    try {
      // Update sort_order for all services based on their new positions
      const updates = reorderedServices.map((service, index) => 
        supabase
          .from('services')
          .update({ sort_order: index + 1 })
          .eq('id', service.id)
      );

      await Promise.all(updates);
      
      // Update local state
      setServices(reorderedServices);
      
      toast({
        title: "Success",
        description: "Services reordered successfully",
      });
    } catch (error) {
      console.error('Error reordering services:', error);
      toast({
        title: "Error",
        description: "Failed to reorder services",
        variant: "destructive",
      });
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
    reorderServices,
    updateServiceOrder,
    toggleServiceVisibility,
    refetch: fetchServices
  };
};
