import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  service_area_count: number;
  total_zipcodes: number;
  service_areas?: Array<{
    id: string;
    area_name: string;
    polygon_coordinates: any;
    is_active: boolean;
    created_at: string;
  }>;
  service_zipcodes?: Array<{
    zipcode: string;
    service_area_id: string;
  }>;
}

interface ServiceAreaAuditLog {
  id: string;
  operation: string;
  change_summary: string;
  changed_at: string;
  changed_by: string;
  worker_id: string;
  area_name: string;
}

export const useAdminServiceAreas = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [auditLogs, setAuditLogs] = useState<ServiceAreaAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_workers_for_admin');
      
      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast({
        title: "Error",
        description: "Failed to load workers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAuditLogs = useCallback(async (workerId?: string) => {
    try {
      let query = supabase
        .from('service_area_audit_logs')
        .select(`
          id,
          operation,
          change_summary,
          changed_at,
          worker_id,
          area_name,
          changed_by
        `)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (workerId) {
        query = query.eq('worker_id', workerId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    }
  }, [toast]);

  const createServiceAreaForWorker = useCallback(async (
    workerId: string,
    areaName: string,
    polygon?: Array<{ lat: number; lng: number }>,
    zipcodesOnly?: string[]
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-service-area-manager', {
        body: {
          workerId,
          areaName,
          polygon,
          zipcodesOnly,
          mode: 'replace_all'
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create service area');
      }

      toast({
        title: "Success",
        description: data.message,
      });

      await fetchWorkers();
      await fetchAuditLogs();
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
  }, [toast, fetchWorkers, fetchAuditLogs]);

  const fetchWorkersWithServiceAreas = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all workers with role 'worker'
      const { data: workersData, error: workersError } = await supabase
        .from('users')
        .select('id, name, email, phone, is_active')
        .eq('role', 'worker')
        .order('name');

      if (workersError) throw workersError;

      // Fetch all service areas
      const { data: serviceAreasData, error: areasError } = await supabase
        .from('worker_service_areas')
        .select('*')
        .order('created_at', { ascending: false });

      if (areasError) throw areasError;

      // Fetch all service zip codes
      const { data: zipcodesData, error: zipcodesError } = await supabase
        .from('worker_service_zipcodes')
        .select('*');

      if (zipcodesError) throw zipcodesError;

      // Combine the data
      const workersWithAreas: Worker[] = (workersData || []).map(worker => {
        const workerAreas = (serviceAreasData || []).filter(area => area.worker_id === worker.id);
        const workerZipcodes = (zipcodesData || []).filter(zip => zip.worker_id === worker.id);

        return {
          ...worker,
          service_area_count: workerAreas.filter(area => area.is_active).length,
          total_zipcodes: workerZipcodes.length,
          service_areas: workerAreas,
          service_zipcodes: workerZipcodes
        };
      });

      setWorkers(workersWithAreas);
    } catch (error) {
      console.error('Error fetching workers with service areas:', error);
      toast({
        title: "Error",
        description: "Failed to load workers and service areas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const refreshData = useCallback(() => {
    fetchWorkersWithServiceAreas();
  }, [fetchWorkersWithServiceAreas]);

  const updateWorkerServiceArea = useCallback(async (
    workerId: string,
    areaId: string,
    updates: Partial<{
      area_name: string;
      is_active: boolean;
      polygon_coordinates: any;
    }>
  ) => {
    try {
      const { error } = await supabase
        .from('worker_service_areas')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', areaId)
        .eq('worker_id', workerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service area updated successfully",
      });

      await refreshData();
      return true;
    } catch (error) {
      console.error('Error updating service area:', error);
      toast({
        title: "Error",
        description: "Failed to update service area",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, refreshData]);

  const deleteWorkerServiceArea = useCallback(async (areaId: string) => {
    try {
      const { error } = await supabase
        .from('worker_service_areas')
        .delete()
        .eq('id', areaId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service area deleted successfully",
      });

      await refreshData();
      return true;
    } catch (error) {
      console.error('Error deleting service area:', error);
      toast({
        title: "Error",
        description: "Failed to delete service area",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, refreshData]);

  return {
    workers,
    auditLogs,
    loading,
    fetchWorkers,
    fetchAuditLogs,
    createServiceAreaForWorker,
    fetchWorkersWithServiceAreas,
    refreshData,
    updateWorkerServiceArea,
    deleteWorkerServiceArea
  };
};