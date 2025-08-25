import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ServiceArea {
  id: string;
  worker_id: string;
  area_name: string;
  polygon_coordinates: any; // JSONB from database
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceZipcode {
  id: string;
  worker_id: string;
  service_area_id: string;
  zipcode: string;
  created_at: string;
}

export const useWorkerServiceAreas = (workerId?: string) => {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [serviceZipcodes, setServiceZipcodes] = useState<ServiceZipcode[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchServiceAreas = useCallback(async () => {
    if (!workerId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_service_areas')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServiceAreas(data || []);

      // Also fetch zipcodes
      const { data: zipData, error: zipError } = await supabase
        .from('worker_service_zipcodes')
        .select('*')
        .eq('worker_id', workerId);

      if (zipError) throw zipError;
      setServiceZipcodes(zipData || []);

    } catch (error) {
      console.error('Error fetching service areas:', error);
      toast({
        title: "Error",
        description: "Failed to load service areas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [workerId, toast]);

  const createServiceArea = useCallback(async (
    areaName: string, 
    polygon: Array<{ lat: number; lng: number }>
  ) => {
    if (!workerId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('polygon-to-zipcodes', {
        body: {
          polygon,
          workerId,
          areaName
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create service area');
      }

      toast({
        title: "Success",
        description: `Service area created with ${data.zipcodesCount} zip codes`,
      });

      await fetchServiceAreas();
      return data;

    } catch (error) {
      console.error('Error creating service area:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create service area",
        variant: "destructive",
      });
      return null;
    }
  }, [workerId, toast, fetchServiceAreas]);

  const deleteServiceArea = useCallback(async (areaId: string) => {
    try {
      const { error } = await supabase
        .from('worker_service_areas')
        .delete()
        .eq('id', areaId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service area deleted",
      });

      await fetchServiceAreas();

    } catch (error) {
      console.error('Error deleting service area:', error);
      toast({
        title: "Error",
        description: "Failed to delete service area",
        variant: "destructive",
      });
    }
  }, [toast, fetchServiceAreas]);

  const getActiveServiceArea = useCallback(() => {
    return serviceAreas.find(area => area.is_active) || null;
  }, [serviceAreas]);

  const getActiveZipcodes = useCallback(() => {
    const activeArea = getActiveServiceArea();
    if (!activeArea) return [];

    return serviceZipcodes
      .filter(zip => zip.service_area_id === activeArea.id)
      .map(zip => zip.zipcode);
  }, [serviceAreas, serviceZipcodes, getActiveServiceArea]);

  return {
    serviceAreas,
    serviceZipcodes,
    loading,
    fetchServiceAreas,
    createServiceArea,
    deleteServiceArea,
    getActiveServiceArea,
    getActiveZipcodes
  };
};