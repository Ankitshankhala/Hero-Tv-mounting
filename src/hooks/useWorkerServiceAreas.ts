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
    polygon: Array<{ lat: number; lng: number }>,
    mode: 'append' | 'replace_all' = 'append'
  ) => {
    if (!workerId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: {
          workerId,
          areaName,
          polygon,
          mode
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create service area');
      }

      toast({
        title: "Success",
        description: `Service area ${mode === 'replace_all' ? 'replaced' : 'created'} with ${data.zipcodesCount} zip codes`,
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

  const addZipCodes = useCallback(async (
    zipCodes: string[],
    areaName?: string,
    mode: 'append' | 'replace_all' = 'append'
  ) => {
    if (!workerId) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
        body: {
          workerId,
          areaName: areaName || `Manual Entry - ${new Date().toLocaleDateString()}`,
          zipcodesOnly: zipCodes,
          mode
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to add ZIP codes');
      }

      toast({
        title: "Success",
        description: `ZIP codes ${mode === 'replace_all' ? 'replaced' : 'added'} - ${data.zipcodesCount} total`,
      });

      await fetchServiceAreas();
      return data;

    } catch (error) {
      console.error('Error adding ZIP codes:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add ZIP codes",
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

  const getActiveServiceAreas = useCallback(() => {
    return serviceAreas.filter(area => area.is_active);
  }, [serviceAreas]);

  const getActiveZipcodes = useCallback(() => {
    const activeAreas = getActiveServiceAreas();
    if (!activeAreas.length) return [];

    return serviceZipcodes
      .filter(zip => activeAreas.some(area => area.id === zip.service_area_id))
      .map(zip => zip.zipcode);
  }, [serviceAreas, serviceZipcodes, getActiveServiceAreas]);

  const updateServiceAreaName = useCallback(async (areaId: string, newName: string) => {
    if (!newName.trim()) {
      toast({
        title: "Error",
        description: "Service area name cannot be empty",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('worker_service_areas')
        .update({ area_name: newName.trim() })
        .eq('id', areaId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service area name updated",
      });

      await fetchServiceAreas();
      return true;

    } catch (error) {
      console.error('Error updating service area name:', error);
      toast({
        title: "Error",
        description: "Failed to update service area name",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, fetchServiceAreas]);

  const toggleServiceAreaStatus = useCallback(async (areaId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.rpc('toggle_service_area_status', {
        p_area_id: areaId,
        p_is_active: isActive
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Service area ${isActive ? 'activated' : 'deactivated'}`,
      });

      await fetchServiceAreas();
      return true;

    } catch (error) {
      console.error('Error toggling service area:', error);
      toast({
        title: "Error",
        description: "Failed to update service area status",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, fetchServiceAreas]);

  return {
    serviceAreas,
    serviceZipcodes,
    loading,
    fetchServiceAreas,
    createServiceArea,
    addZipCodes,
    deleteServiceArea,
    getActiveServiceAreas,
    getActiveZipcodes,
    toggleServiceAreaStatus,
    updateServiceAreaName
  };
};