import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HealthData {
  postgis_version?: string;
  zcta_polygon_count?: number;
  zcta_adequate?: boolean;
  zip_code_count?: number;
  zip_adequate?: boolean;
  sample_test_zipcode_count?: number;
  sample_test_success?: boolean;
  sample_test_error?: string;
  sample_zipcodes?: string[];
  overall_health?: 'healthy' | 'degraded' | 'critical';
}

export const SpatialHealthDiagnostics: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_spatial_health');
      
      if (error) {
        throw error;
      }
      
      setHealthData(data as HealthData);
      toast({
        title: "Health Check Complete",
        description: `Overall status: ${(data as any)?.overall_health || 'unknown'}`,
      });
    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Degraded</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Spatial Health Diagnostics
          </CardTitle>
          <Button 
            onClick={runHealthCheck} 
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Run Check
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!healthData && !loading && (
          <div className="text-center py-6 text-muted-foreground">
            Click "Run Check" to diagnose spatial system health
          </div>
        )}
        
        {loading && (
          <div className="text-center py-6">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Running health diagnostics...
          </div>
        )}
        
        {healthData && (
          <div className="space-y-4">
            {/* Overall Status */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Overall Health:</span>
              {getStatusBadge(healthData.overall_health)}
            </div>
            
            <Separator />
            
            {/* PostGIS Version */}
            <div className="flex items-center justify-between">
              <span>PostGIS Version:</span>
              <span className="font-mono text-sm">{healthData.postgis_version || 'Unknown'}</span>
            </div>
            
            {/* ZIP Code Polygon Data */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>ZIP Code Polygons (ZCTA):</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{healthData.zcta_polygon_count?.toLocaleString() || 0}</span>
                  {healthData.zcta_adequate ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <XCircle className="h-4 w-4 text-red-600" />
                  }
                </div>
              </div>
              {!healthData.zcta_adequate && (
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  ⚠️ Need 30,000+ ZIP polygons for optimal coverage
                </div>
              )}
            </div>
            
            {/* ZIP Code Point Data */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>ZIP Code Points:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{healthData.zip_code_count?.toLocaleString() || 0}</span>
                  {healthData.zip_adequate ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <XCircle className="h-4 w-4 text-red-600" />
                  }
                </div>
              </div>
              {!healthData.zip_adequate && (
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  ⚠️ Need 40,000+ ZIP codes for complete US coverage
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Sample Test */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Sample Intersection Test:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{healthData.sample_test_zipcode_count || 0} ZIPs found</span>
                  {healthData.sample_test_success ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <XCircle className="h-4 w-4 text-red-600" />
                  }
                </div>
              </div>
              
              {healthData.sample_test_error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  ❌ Error: {healthData.sample_test_error}
                </div>
              )}
              
              {healthData.sample_zipcodes && healthData.sample_zipcodes.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Sample ZIPs: </span>
                  <span className="font-mono">{healthData.sample_zipcodes.slice(0, 5).join(', ')}</span>
                  {healthData.sample_zipcodes.length > 5 && '...'}
                </div>
              )}
            </div>
            
            {/* Recommendations */}
            {healthData.overall_health !== 'healthy' && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Recommendations:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  {!healthData.zcta_adequate && (
                    <li>Load complete US ZCTA polygon dataset for accurate spatial intersection</li>
                  )}
                  {!healthData.zip_adequate && (
                    <li>Load complete US ZIP code point dataset for fallback coverage</li>
                  )}
                  {!healthData.sample_test_success && (
                    <li>Check PostGIS installation and spatial function configuration</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpatialHealthDiagnostics;