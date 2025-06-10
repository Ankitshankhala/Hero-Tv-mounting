
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Service {
  id: string;
  name: string;
  base_price: number;
  duration_minutes: number;
  description: string;
  is_active: boolean;
  image?: string;
}

export const useServicesManager = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Default services that match the landing page
  const defaultServices = [
    {
      id: 'tv-mounting',
      name: 'TV Mounting',
      base_price: 90,
      duration_minutes: 60,
      description: 'Professional TV wall mounting with perfect positioning',
      image: '/lovable-uploads/d6a6d8ff-7ee8-45a6-bd82-6aa3aab9844a.png',
      is_active: true
    },
    {
      id: 'full-motion-mount',
      name: 'Full Motion Mount',
      base_price: 80,
      duration_minutes: 45,
      description: 'Articulating mount for maximum flexibility',
      image: '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png',
      is_active: true
    },
    {
      id: 'flat-mount',
      name: 'Flat Mount',
      base_price: 50,
      duration_minutes: 30,
      description: 'Low-profile flat wall mount',
      image: '/lovable-uploads/3c8ed729-7438-43d2-88ad-328ac45775e1.png',
      is_active: true
    },
    {
      id: 'cover-cables',
      name: 'Cover Cables',
      base_price: 20,
      duration_minutes: 30,
      description: 'Clean cable management with decorative covers',
      image: '/lovable-uploads/01571029-7b6a-4df2-9c0f-1c0b120fedff.png',
      is_active: true
    },
    {
      id: 'simple-concealment',
      name: 'Simple Cable Concealment',
      base_price: 50,
      duration_minutes: 45,
      description: 'Basic in-wall cable concealment',
      image: '/lovable-uploads/f430204b-2ef5-4727-b3ee-7f4d9d26ded4.png',
      is_active: true
    },
    {
      id: 'fire-safe-concealment',
      name: 'Fire Safe Cable Concealment',
      base_price: 100,
      duration_minutes: 90,
      description: 'Fire-rated in-wall cable concealment system',
      image: '/lovable-uploads/71fa4731-cb99-42cb-bfd0-29236a1bc91a.png',
      is_active: true
    },
    {
      id: 'general-mounting',
      name: 'General Mounting',
      base_price: 75,
      duration_minutes: 60,
      description: 'General mounting services per hour',
      image: '/lovable-uploads/4cc7c28c-dd34-4b03-82ef-6b8280bc616f.png',
      is_active: true
    },
    {
      id: 'furniture-assembly',
      name: 'Furniture Assembly',
      base_price: 50,
      duration_minutes: 60,
      description: 'Professional furniture assembly per hour',
      image: '/lovable-uploads/15729bed-70cc-4a81-afe5-f295b900175d.png',
      is_active: true
    },
    {
      id: 'hire-second-technician',
      name: 'Hire Second Technician',
      base_price: 65,
      duration_minutes: 60,
      description: 'Additional technician for complex installations',
      image: '/lovable-uploads/9ffb6618-666e-44a7-a41b-bb031fd291b9.png',
      is_active: true
    }
  ];

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // If no services in database, use default services
      if (!data || data.length === 0) {
        setServices(defaultServices);
      } else {
        // Map database services to include images from default services
        const servicesWithImages = data.map(service => {
          const defaultService = defaultServices.find(ds => ds.id === service.id || ds.name === service.name);
          return {
            ...service,
            image: defaultService?.image
          };
        });
        setServices(servicesWithImages);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      // Fallback to default services
      setServices(defaultServices);
    } finally {
      setLoading(false);
    }
  };

  const addService = async (serviceData: Omit<Service, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .insert({
          name: serviceData.name,
          base_price: serviceData.base_price,
          duration_minutes: serviceData.duration_minutes,
          description: serviceData.description,
          is_active: serviceData.is_active
        })
        .select()
        .single();

      if (error) throw error;

      const newService = { ...data, image: serviceData.image };
      setServices(prev => [...prev, newService]);
      
      toast({
        title: "Success",
        description: "Service added successfully",
      });

      return newService;
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

  const updateService = async (id: string, updates: Partial<Service>) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .update({
          name: updates.name,
          base_price: updates.base_price,
          duration_minutes: updates.duration_minutes,
          description: updates.description,
          is_active: updates.is_active
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setServices(prev => prev.map(service => 
        service.id === id ? { ...service, ...updates } : service
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
        .delete()
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
      throw error;
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
