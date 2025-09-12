import { useCallback } from 'react';
import { useAdminServiceAreas } from './useAdminServiceAreas';
import { useWorkerServiceAreas } from './useWorkerServiceAreas';
import { useToast } from './use-toast';

interface ServiceArea {
  id: string;
  area_name: string;
  polygon_coordinates: any;
  is_active: boolean;
  created_at: string;
  worker_id?: string;
}

interface UseAreaNameEditorOptions {
  workerId?: string;
  adminMode?: boolean;
  onSuccess?: (areaId: string, newName: string) => void;
  onError?: (error: Error) => void;
}

export const useAreaNameEditor = (options: UseAreaNameEditorOptions = {}) => {
  const { workerId, adminMode = false, onSuccess, onError } = options;
  const { toast } = useToast();
  
  // Use appropriate hook based on mode
  const adminHook = useAdminServiceAreas();
  const workerHook = useWorkerServiceAreas(workerId);
  
  // Select the appropriate update function
  const updateServiceAreaName = adminMode 
    ? adminHook.updateServiceAreaName 
    : workerHook.updateServiceAreaName;

  const updateAreaName = useCallback(async (areaId: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) {
      toast({
        title: "Validation Error",
        description: "Area name cannot be empty",
        variant: "destructive",
      });
      return false;
    }

    try {
      const success = await updateServiceAreaName(areaId, newName.trim());
      
      if (success) {
        onSuccess?.(areaId, newName.trim());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating area name:', error);
      onError?.(error as Error);
      
      toast({
        title: "Error",
        description: "Failed to update area name. Please try again.",
        variant: "destructive",
      });
      
      return false;
    }
  }, [updateServiceAreaName, onSuccess, onError, toast]);

  // Function to validate area name
  const validateAreaName = useCallback((name: string): { isValid: boolean; error?: string } => {
    if (!name.trim()) {
      return { isValid: false, error: "Area name is required" };
    }
    
    if (name.trim().length < 2) {
      return { isValid: false, error: "Area name must be at least 2 characters long" };
    }
    
    if (name.trim().length > 100) {
      return { isValid: false, error: "Area name must be less than 100 characters" };
    }
    
    // Check for invalid characters (optional)
    const invalidChars = /[<>]/;
    if (invalidChars.test(name)) {
      return { isValid: false, error: "Area name contains invalid characters" };
    }
    
    return { isValid: true };
  }, []);

  // Function to check if name already exists (optional feature)
  const checkNameExists = useCallback(async (name: string, excludeAreaId?: string): Promise<boolean> => {
    try {
      const areas = adminMode ? adminHook.workers : [{ service_areas: workerHook.serviceAreas }];
      
      const allAreas = areas.flatMap(worker => 
        'service_areas' in worker ? worker.service_areas : []
      );
      
      return allAreas.some(area => 
        area.area_name.toLowerCase() === name.toLowerCase() && 
        area.id !== excludeAreaId
      );
    } catch (error) {
      console.error('Error checking name existence:', error);
      return false;
    }
  }, [adminMode, adminHook.workers, workerHook.serviceAreas]);

  return {
    updateAreaName,
    validateAreaName,
    checkNameExists,
    isLoading: adminMode ? adminHook.loading : workerHook.loading,
    // Expose the underlying hooks for additional functionality
    adminHook: adminMode ? adminHook : null,
    workerHook: !adminMode ? workerHook : null
  };
};

// Utility function for bulk name updates
export const useBulkAreaNameEditor = (options: UseAreaNameEditorOptions = {}) => {
  const { updateAreaName, validateAreaName } = useAreaNameEditor(options);
  const { toast } = useToast();

  const updateMultipleAreaNames = useCallback(async (
    updates: Array<{ areaId: string; newName: string }>
  ): Promise<{ success: number; failed: number; errors: Array<{ areaId: string; error: string }> }> => {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ areaId: string; error: string }>
    };

    // Validate all names first
    for (const update of updates) {
      const validation = validateAreaName(update.newName);
      if (!validation.isValid) {
        results.failed++;
        results.errors.push({
          areaId: update.areaId,
          error: validation.error || 'Invalid name'
        });
      }
    }

    // Process valid updates
    const validUpdates = updates.filter(update => {
      const validation = validateAreaName(update.newName);
      return validation.isValid;
    });

    for (const update of validUpdates) {
      try {
        const success = await updateAreaName(update.areaId, update.newName);
        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            areaId: update.areaId,
            error: 'Update failed'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          areaId: update.areaId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Show summary toast
    if (results.success > 0 && results.failed === 0) {
      toast({
        title: "Success",
        description: `Successfully updated ${results.success} area names`,
      });
    } else if (results.success > 0 && results.failed > 0) {
      toast({
        title: "Partial Success",
        description: `Updated ${results.success} areas, ${results.failed} failed`,
        variant: "destructive",
      });
    } else if (results.failed > 0) {
      toast({
        title: "Error",
        description: `Failed to update ${results.failed} area names`,
        variant: "destructive",
      });
    }

    return results;
  }, [updateAreaName, validateAreaName, toast]);

  return {
    updateMultipleAreaNames,
    updateAreaName,
    validateAreaName
  };
};

export default useAreaNameEditor;
