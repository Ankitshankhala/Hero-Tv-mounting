import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SpatialHealthData {
  postgis_version: string;
  zcta_polygons_count: number;
  us_zip_codes_count: number;
  sample_test_zipcode_count: number;
  sample_test_success: boolean;
  sample_test_error?: string;
  overall_health: 'healthy' | 'degraded_no_polygons' | 'unhealthy';
}

interface SpatialHealthResult {
  success: boolean;
  health_data: SpatialHealthData;
  timestamp: string;
  recommendations: string[];
  error?: string;
}

export const useSpatialHealthCheck = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [healthData, setHealthData] = useState<SpatialHealthResult | null>(null);
  const { toast } = useToast();

  const runHealthCheck = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('spatial-health-check');

      if (error) {
        throw error;
      }

      setHealthData(data);

      // Show toast based on health status
      const healthStatus = data.health_data.overall_health;
      if (healthStatus === 'healthy') {
        toast({
          title: "Spatial System Health: Excellent",
          description: "All spatial systems are functioning correctly",
        });
      } else if (healthStatus === 'degraded_no_polygons') {
        toast({
          title: "Spatial System Health: Degraded", 
          description: "System functional but using fallback methods",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Spatial System Health: Critical",
          description: "Multiple spatial system issues detected",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: "Unable to check spatial system health",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    runHealthCheck,
    isLoading,
    healthData,
  };
};