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

      // Provide more detailed success message
      const syncResult = data.syncResult;
      let description = `ZIP codes ${mode === 'replace_all' ? 'replaced' : 'added'} - ${data.zipcodesCount} total`;
      
      if (syncResult) {
        const parts = [];
        if (syncResult.inserted > 0) parts.push(`${syncResult.inserted} new`);
        if (syncResult.updated > 0) parts.push(`${syncResult.updated} updated`);
        if (syncResult.skipped > 0) parts.push(`${syncResult.skipped} skipped`);
        
        if (parts.length > 0) {
          description = `ZIP codes processed: ${parts.join(', ')}`;
        }
      }
      
      toast({
        title: "Success",
        description,
      });

      await fetchServiceAreas();
      return data;

    } catch (error) {
      console.error('Error adding ZIP codes:', error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to add ZIP codes";
      if (error.message?.includes('duplicate key value violates unique constraint')) {
        errorMessage = "Some ZIP codes already exist in your service areas. They have been updated instead of duplicated.";
      } else if (error.message?.includes('Failed to insert ZIP codes')) {
        errorMessage = "Unable to save ZIP codes. Please try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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

  // Function to get ZIP code count for a specific service area
  const getServiceAreaZipCount = useCallback((areaId: string) => {
    // First, count ZIP codes directly associated with this area
    const directlyAssociated = serviceZipcodes.filter(zip => zip.service_area_id === areaId).length;
    
    // If we have directly associated ZIP codes, return that count
    if (directlyAssociated > 0) {
      return directlyAssociated;
    }
    
    // If no directly associated ZIP codes, check if this is a ZIP-only area
    const area = serviceAreas.find(a => a.id === areaId);
    if (area && (!area.polygon_coordinates || !Array.isArray(area.polygon_coordinates) || area.polygon_coordinates.length < 3)) {
      // This appears to be a ZIP-only area, count ZIP codes with null service_area_id
      // This is a fallback for cases where service_area_id associations are missing
      const nullAreaZips = serviceZipcodes.filter(zip => !zip.service_area_id);
      
      // If there's only one ZIP-only area, assign all null ZIP codes to it
      const zipOnlyAreas = serviceAreas.filter(a => 
        !a.polygon_coordinates || !Array.isArray(a.polygon_coordinates) || a.polygon_coordinates.length < 3
      );
      
      if (zipOnlyAreas.length === 1 && zipOnlyAreas[0].id === areaId) {
        return nullAreaZips.length;
      }
    }
    
    return directlyAssociated;
  }, [serviceZipcodes, serviceAreas]);

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
      // Get old area data for audit log
      const { data: oldAreaData } = await supabase
        .from('worker_service_areas')
        .select('area_name')
        .eq('id', areaId)
        .single();

      const { error } = await supabase
        .from('worker_service_areas')
        .update({ area_name: newName.trim() })
        .eq('id', areaId);

      if (error) throw error;

      // Create audit log for rename operation
      if (workerId) {
        await supabase.rpc('create_service_area_audit_log', {
          p_worker_id: workerId,
          p_record_id: areaId,
          p_operation: 'rename',
          p_table_name: 'worker_service_areas',
          p_new_data: { area_name: newName.trim() },
          p_old_data: { area_name: oldAreaData?.area_name },
          p_area_name: newName.trim(),
          p_change_summary: `Area renamed from "${oldAreaData?.area_name}" to "${newName.trim()}"`
        });
      }

      toast({
        title: "Success",
        description: "Name updated. Coverage unchanged.",
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
    getServiceAreaZipCount,
    toggleServiceAreaStatus,
    updateServiceAreaName
  };
};