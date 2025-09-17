import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { optimizedSupabaseCall, measureApiCall } from '@/utils/optimizedApi';
import { batchComputeWorkerZctaStats } from '@/utils/zctaWorkerCoverage';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  service_area_count: number;
  total_zipcodes: number;
  zcta_zipcodes?: number; // ZCTA-computed ZIP count
  service_areas?: Array<{
    id: string;
    worker_id?: string;
    area_name: string;
    polygon_coordinates?: any;
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

export const useAdminServiceAreas = (forceFresh = false) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [auditLogs, setAuditLogs] = useState<ServiceAreaAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      // Get basic worker info first
      const { data: workers, error: workersError } = await supabase
        .from('users')
        .select('id, name, email, phone, is_active, created_at')
        .eq('role', 'worker')
        .order('name');

      if (workersError) throw workersError;

      // Get counts from canonical tables for each worker
      const workersWithStats = await Promise.all((workers || []).map(async (worker) => {
        // Count service areas for this worker
        const { count: serviceAreaCount } = await supabase
          .from('worker_service_areas')
          .select('*', { count: 'exact', head: true })
          .eq('worker_id', worker.id)
          .eq('is_active', true);

        // Count ZIP codes from canonical table
        const { count: zipCodeCount } = await supabase
          .from('worker_service_zipcodes')
          .select('*', { count: 'exact', head: true })
          .eq('worker_id', worker.id);

        return {
          ...worker,
          service_area_count: serviceAreaCount || 0,
          total_zipcodes: zipCodeCount || 0
        };
      }));

      setWorkers(workersWithStats);
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
      const cacheKey = workerId ? `audit-logs-worker-${workerId}` : 'audit-logs-all';
      
      const data = await optimizedSupabaseCall(
        cacheKey,
        async () => {
          let query = supabase
            .from('service_area_audit_logs')
            .select('id, operation, change_summary, changed_at, worker_id, area_name, changed_by')
            .order('changed_at', { ascending: false })
            .limit(50);

          if (workerId) {
            query = query.eq('worker_id', workerId);
          }

          const { data, error } = await query;
          if (error) throw error;
          return data;
        },
        true, // use cache
        30000 // 30 second cache
      );
      
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
      const { data, error } = await supabase.functions.invoke('service-area-upsert', {
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

  const fetchWorkersWithServiceAreas = useCallback(async (bypassCache = false) => {
    setLoading(true);
    try {
      const data = await optimizedSupabaseCall(
        'workers-with-service-areas',
        async () => {
          // Use Promise.all for parallel fetching - much faster
          const [workersData, serviceAreasData, zipcodesData] = await Promise.all([
            supabase
              .from('users')
              .select('id, name, email, phone, is_active')
              .eq('role', 'worker')
              .order('name'),
            supabase
              .from('worker_service_areas')
              .select('id, worker_id, area_name, polygon_coordinates, geom, is_active, created_at')
              .order('created_at', { ascending: false }),
            supabase
              .from('worker_service_zipcodes')
              .select('worker_id, zipcode, service_area_id')
          ]);

          if (workersData.error) throw workersData.error;
          if (serviceAreasData.error) throw serviceAreasData.error;
          if (zipcodesData.error) throw zipcodesData.error;

          // Combine the data efficiently
          const workersWithAreas: Worker[] = await Promise.all((workersData.data || []).map(async worker => {
            const workerAreas = (serviceAreasData.data || []).filter(area => area.worker_id === worker.id);
            const workerZipcodes = (zipcodesData.data || []).filter(zip => zip.worker_id === worker.id);
            
            // Get total zipcode count with error handling and fallback
            let total_zipcodes = 0;
            try {
              const { data: stats, error: statsError } = await supabase.rpc('get_worker_zipcode_stats', {
                p_worker_id: worker.id
              });
              
              if (statsError) {
                console.warn(`RPC function failed for worker ${worker.id}:`, statsError);
                // Fallback: count directly from table
                const { count } = await supabase
                  .from('worker_service_zipcodes')
                  .select('*', { count: 'exact', head: true })
                  .eq('worker_id', worker.id);
                total_zipcodes = count || 0;
              } else {
                total_zipcodes = stats?.[0]?.total_zipcodes || 0;
              }
            } catch (error) {
              console.warn(`Error getting zipcode stats for worker ${worker.id}:`, error);
              // Final fallback: count directly from table
              try {
                const { count } = await supabase
                  .from('worker_service_zipcodes')
                  .select('*', { count: 'exact', head: true })
                  .eq('worker_id', worker.id);
                total_zipcodes = count || 0;
              } catch (fallbackError) {
                console.error(`Fallback count failed for worker ${worker.id}:`, fallbackError);
                total_zipcodes = 0;
              }
            }

            return {
              ...worker,
              service_area_count: workerAreas.filter(area => area.is_active).length,
              total_zipcodes,
              service_areas: workerAreas,
              service_zipcodes: workerZipcodes
            };
          }));

          // Compute ZCTA coverage for all workers in parallel
          try {
            const zctaStatsMap = await batchComputeWorkerZctaStats(workersWithAreas);
            
            // Add ZCTA ZIP count to worker data
            const workersWithZcta = workersWithAreas.map(worker => ({
              ...worker,
              zcta_zipcodes: zctaStatsMap.get(worker.id)?.totalZctaZipcodes || 0
            }));
            
            return workersWithZcta;
          } catch (zctaError) {
            console.warn('Error computing ZCTA coverage, using database ZIP counts:', zctaError);
            // Return workers without ZCTA data if computation fails
            return workersWithAreas;
          }

          return workersWithAreas;
        },
        !bypassCache && !forceFresh, // use cache unless bypassed or forced fresh
        bypassCache || forceFresh ? 0 : 30000 // no cache if bypassed, otherwise 30 second cache
      );

      setWorkers(data);
    } catch (error) {
      console.error('Error fetching workers with service areas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: "Database Error",
        description: `Failed to load workers and service areas: ${errorMessage}`,
        variant: "destructive",
      });
      
      // Set empty data instead of leaving undefined
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const refreshData = useCallback((forceFresh = false) => {
    fetchWorkersWithServiceAreas(forceFresh);
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
      // Get old area data and worker ID for audit log
      const { data: oldAreaData } = await supabase
        .from('worker_service_areas')
        .select('area_name, worker_id')
        .eq('id', areaId)
        .single();

      const { error } = await supabase
        .from('worker_service_areas')
        .update({ area_name: newName.trim() })
        .eq('id', areaId);

      if (error) throw error;

      // Create audit log for rename operation
      if (oldAreaData?.worker_id) {
        await supabase.rpc('create_service_area_audit_log', {
          p_worker_id: oldAreaData.worker_id,
          p_record_id: areaId,
          p_operation: 'admin_rename',
          p_table_name: 'worker_service_areas',
          p_new_data: { area_name: newName.trim() },
          p_old_data: { area_name: oldAreaData.area_name },
          p_area_name: newName.trim(),
          p_change_summary: `Admin renamed area from "${oldAreaData.area_name}" to "${newName.trim()}"`
        });
      }

      toast({
        title: "Success",
        description: "Name updated. Coverage unchanged.",
      });

      await refreshData(true);
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

  const removeZipcodeFromWorker = useCallback(async (
    workerId: string, 
    zipcode: string, 
    serviceAreaId?: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-remove-worker-zip', {
        body: { workerId, zipcode, serviceAreaId }
      });

      if (error) throw error;

      // Refresh worker data to reflect changes
      await fetchWorkersWithServiceAreas(true);
      
      return data;
    } catch (error) {
      console.error('Error removing ZIP code:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchWorkersWithServiceAreas]);

  const mergeWorkerServiceAreas = useCallback(async (workerId: string, newAreaName: string) => {
    try {
      const { data, error } = await supabase.rpc('merge_worker_service_areas', {
        p_worker_id: workerId,
        p_new_area_name: newAreaName
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to merge service areas');
      }

      toast({
        title: "Success",
        description: result.message,
      });

      await fetchWorkers();
      await fetchAuditLogs();
      return result;

    } catch (error) {
      console.error('Error merging service areas:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to merge service areas",
        variant: "destructive",
      });
      throw error;
    }
  }, [fetchWorkers, fetchAuditLogs, toast]);

  const addZipcodesToExistingArea = useCallback(async (
    workerId: string, 
    existingAreaId: string, 
    zipcodes: string[],
    mode: 'append' | 'replace_all' = 'append'
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-service-area-manager', {
        body: {
          workerId,
          existingAreaId,
          zipcodesOnly: zipcodes,
          mode
        }
      });

      if (error) throw error;

      // Show detailed success message based on the response
      if (data?.details) {
        toast({
          title: "Success",
          description: data.details,
        });
      } else {
        toast({
          title: "Success", 
          description: `Added ${zipcodes.length} ZIP codes to existing service area`,
        });
      }

      // Refresh data
      await fetchWorkersWithServiceAreas(true);
      await fetchAuditLogs();
      return data;

    } catch (error) {
      console.error('Error adding ZIP codes to existing area:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add ZIP codes",
        variant: "destructive",
      });
      throw error;
    }
  }, [fetchWorkersWithServiceAreas, fetchAuditLogs, toast]);

  const updateServiceAreaForWorker = useCallback(async (areaId: string, updates: { polygon_coordinates?: any; area_name?: string; is_active?: boolean }) => {
    try {
      const { data, error } = await supabase
        .from('worker_service_areas')
        .update(updates)
        .eq('id', areaId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service area updated successfully",
      });

      await refreshData();
      return data;
    } catch (error) {
      console.error('Error updating service area:', error);
      toast({
        title: "Error",
        description: "Failed to update service area",
        variant: "destructive",
      });
      return null;
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
    updateServiceAreaForWorker,
    updateServiceAreaName,
    deleteWorkerServiceArea,
    removeZipcodeFromWorker,
    mergeWorkerServiceAreas,
    addZipcodesToExistingArea
  };
};