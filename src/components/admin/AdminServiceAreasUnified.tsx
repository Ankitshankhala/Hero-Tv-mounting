import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleWorkerCard } from './SimpleWorkerCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  MapPin, 
  Users, 
  Download, 
  Eye, 
  EyeOff, 
  Filter, 
  RefreshCw, 
  Edit3, 
  ArrowLeft, 
  Edit2, 
  Check, 
  X as XIcon, 
  Layers,
  Map,
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { BulkZipcodeAssignment } from './BulkZipcodeAssignment';
import { OptimizedZipDataManager } from './OptimizedZipDataManager';
import { PerformanceOptimizationSwitch } from './PerformanceOptimizationSwitch';
import { 
  LazyEnhancedWorkerServiceAreasMapImproved, 
  LazyAdminServiceAreaMap,
  withLazyLoading,
  AdminComponentLoader
} from './LazyAdminComponents';
import AdminServiceAreaMap from './AdminServiceAreaMap';
import ServiceAreaMap from '@/components/worker/service-area/ServiceAreaMap';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';
import { useRealtimeServiceAreas } from '@/hooks/useRealtimeServiceAreas';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface CoverageWorker {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  total_zipcodes?: number;
  service_areas: Array<{
    id: string;
    area_name: string;
    polygon_coordinates: any;
    is_active: boolean;
    created_at: string;
  }>;
  service_zipcodes: Array<{
    zipcode: string;
    service_area_id: string;
  }>;
}

export const AdminServiceAreasUnified = () => {
  // Coverage Manager states
  const [searchTerm, setSearchTerm] = useState('');
  const [zipCodeFilter, setZipCodeFilter] = useState('');
  const [showInactiveWorkers, setShowInactiveWorkers] = useState(false);
  const [showInactiveAreas, setShowInactiveAreas] = useState(false);

  // Service Area Manager states
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'overview' | 'manage' | 'drawing'>('overview');
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [initialLoaded, setInitialLoaded] = useState(false);

  const {
    workers: adminWorkers,
    auditLogs,
    loading,
    fetchWorkersWithServiceAreas,
    fetchWorkers,
    fetchAuditLogs,
    refreshData,
    addZipcodesToExistingArea,
    updateServiceAreaName
  } = useAdminServiceAreas();
  const workers = adminWorkers as CoverageWorker[];
  const { toast } = useToast();

  // Optimized initial data loading - only fetch when component mounts
  useEffect(() => {
    if (!initialLoaded) {
      console.log('AdminServiceAreasUnified: Initial loading...');
      // Only load basic data initially, defer heavy operations
      fetchWorkersWithServiceAreas(false); // Use cache
      setInitialLoaded(true);
    }
  }, [fetchWorkersWithServiceAreas, initialLoaded]);

  // Defer audit logs loading until needed
  useEffect(() => {
    if (selectedWorkerId && initialLoaded) {
      fetchAuditLogs(selectedWorkerId);
    }
  }, [selectedWorkerId, initialLoaded, fetchAuditLogs]);

  // Optimized debug logging - only log when data changes significantly
  useEffect(() => {
    if (workers.length > 0) {
      console.log('AdminServiceAreasUnified: Workers loaded:', workers.length, 'workers');
    }
  }, [workers.length]);

  // Auto-select first worker when in manage mode and optionally default to drawing mode
  useEffect(() => {
    if (viewMode === 'manage' && workers.length > 0 && !selectedWorkerId && initialLoaded) {
      const firstActiveWorker = workers.find(w => w.is_active) || workers[0];
      if (firstActiveWorker) {
        setSelectedWorkerId(firstActiveWorker.id);
        // Defer audit log loading
        setTimeout(() => fetchAuditLogs(firstActiveWorker.id), 100);
        
        // Optional: Auto-switch to drawing mode to guide users to more accurate flow
        // setTimeout(() => setViewMode('drawing'), 200);
      }
    }
  }, [workers, selectedWorkerId, viewMode, fetchAuditLogs, initialLoaded]);

  // Optimized real-time updates - only enable after initial load
  useRealtimeServiceAreas({
    onUpdate: () => {
      if (initialLoaded) {
        refreshData(false); // Use cache for real-time updates
        if (selectedWorkerId) {
          fetchAuditLogs(selectedWorkerId);
        }
      }
    },
    onError: (error) => {
      console.error('Realtime sync error:', error);
      toast({
        title: "Sync Error",
        description: "Real-time synchronization encountered an issue",
        variant: "destructive",
      });
    },
    enableCacheInvalidation: true,
    throttleMs: 500, // Increased throttle to reduce load
    // Limit realtime change feed to the selected worker to avoid cross-worker updates
    filterWorkerId: selectedWorkerId || undefined
  });

  // Debounce worker selection
  const {
    debouncedCallback: debouncedWorkerSelect
  } = useDebounce((workerId: string) => {
    setSelectedWorkerId(workerId);
    fetchAuditLogs(workerId);
  }, 250);

  const filteredWorkers = (workers || []).filter(worker => {
    const matchesSearch = worker.name?.toLowerCase().includes(searchTerm.toLowerCase()) || worker.email?.toLowerCase().includes(searchTerm.toLowerCase()) || worker.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZipCode = !zipCodeFilter || (worker.service_zipcodes || []).some(zip => zip.zipcode.includes(zipCodeFilter));
    const matchesActiveFilter = showInactiveWorkers || worker.is_active;
    return matchesSearch && matchesZipCode && matchesActiveFilter;
  });

  const selectedWorker = selectedWorkerId ? (workers || []).find(w => w.id === selectedWorkerId) : null;

  const handleWorkerSelect = (workerId: string) => {
    if (viewMode === 'overview') {
      setSelectedWorkerId(workerId === selectedWorkerId ? null : workerId);
    } else {
      setSelectedWorkerId(workerId);
      debouncedWorkerSelect(workerId);
    }
  };

  const handleRefresh = () => {
    refreshData(true); // Force fresh data only on manual refresh
    if (selectedWorkerId) {
      fetchAuditLogs(selectedWorkerId);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredWorkers.flatMap(worker => (worker.service_areas || []).filter(area => showInactiveAreas || area.is_active).map(area => ({
      'Worker Name': worker.name || '',
      'Worker Email': worker.email || '',
      'Worker ID': worker.id || '',
      'Area Name': area.area_name || '',
      'Area Status': area.is_active ? 'Active' : 'Inactive',
      'Zip Codes': (worker.service_zipcodes || []).filter(zip => zip.service_area_id === area.id).map(zip => zip.zipcode).join(', '),
      'Created Date': new Date(area.created_at).toLocaleDateString(),
      'Worker Active': worker.is_active ? 'Yes' : 'No'
    })));
    exportToCSV(exportData, 'worker-service-areas');
    toast({
      title: "Export Complete",
      description: "Service area data exported to CSV"
    });
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(filteredWorkers, 'worker-service-areas');
      toast({
        title: "Export Complete",
        description: "Service area data exported to PDF"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF export",
        variant: "destructive"
      });
    }
  };

  // Helper function to safely parse polygon coordinates
  const safeParsePolygonCoords = (coordinates: any): boolean => {
    if (!coordinates) return false;
    try {
      let coords;
      if (typeof coordinates === 'string') {
        coords = JSON.parse(coordinates);
      } else if (typeof coordinates === 'object') {
        coords = coordinates;
      } else {
        return false;
      }
      return Array.isArray(coords) && coords.length > 0;
    } catch (error) {
      console.warn('Error parsing polygon coordinates:', error);
      return false;
    }
  };

  const getWorkerStats = (worker: CoverageWorker) => {
    // Prefer server-computed total if available; otherwise count all unique ZIPs for the worker
    // Note: Some ZIPs may have null service_area_id (manual entries). Including them ensures stats aren't undercounted.
    const totalZipCodes = worker.total_zipcodes || new Set((worker.service_zipcodes || []).map(zip => zip.zipcode)).size;
    const activeAreas = (worker.service_areas || []).filter(area => area.is_active).length;

    // Count areas that need backfilling (have polygons but no ZIP codes)
    const areasNeedingBackfill = (worker.service_areas || []).filter(area => {
      const hasPolygon = safeParsePolygonCoords(area.polygon_coordinates);
      const areaZipCodes = (worker.service_zipcodes || []).filter(zip => zip.service_area_id === area.id);
      return hasPolygon && areaZipCodes.length === 0 && area.is_active;
    }).length;

    return {
      activeAreas,
      totalZipCodes,
      areasNeedingBackfill
    };
  };

  const startEditing = (areaId: string, currentName: string) => {
    setEditingArea(areaId);
    setEditingName(currentName);
  };

  const cancelEditing = () => {
    setEditingArea(null);
    setEditingName('');
  };

  const saveAreaName = async (areaId: string) => {
    const success = await updateServiceAreaName(areaId, editingName);
    if (success) {
      setEditingArea(null);
      setEditingName('');
    }
  };

  return null;
};