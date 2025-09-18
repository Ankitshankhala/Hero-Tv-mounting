import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Database, RefreshCw, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface HealthData {
  comprehensive_zip_codes: string;
  comprehensive_zcta_polygons: string;
  missing_coordinates: string;
  zips_with_coverage: string;
  health_status: string;
}

export const OptimizedZipDataManager = () => {
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const { toast } = useToast();

  const loadSampleData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('populate-comprehensive-zip-data', {
        body: { action: 'load_sample_data' }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Sample Data Loaded",
          description: `${data.message}. Loaded ${data.loadedCount} ZIP codes.`,
        });
        setHealthData(data.healthCheck);
      } else {
        throw new Error(data.error || 'Failed to load sample data');
      }
    } catch (error) {
      console.error('Error loading sample data:', error);
      toast({
        title: "Error",
        description: `Failed to load sample ZIP data: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBulkData = async () => {
    if (!confirm('This will process 33,000+ ZIP codes with data enrichment. This may take 10-15 minutes. Continue?')) {
      return;
    }

    setBulkLoading(true);
    try {
      toast({
        title: "Bulk Import Started",
        description: "Processing 33,000+ ZIP codes with enrichment. This will take several minutes...",
      });

      const { data, error } = await supabase.functions.invoke('populate-comprehensive-zip-data', {
        body: { action: 'load_bulk_data' }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Bulk Import Complete!",
          description: `Successfully processed ${data.totalProcessed} ZIP codes. Inserted ${data.insertedCount} with enriched data.`,
        });
        setHealthData(data.healthCheck);
      } else {
        throw new Error(data.error || 'Failed to load bulk data');
      }
    } catch (error) {
      console.error('Error loading bulk data:', error);
      toast({
        title: "Bulk Import Error",
        description: `Failed to complete bulk import: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('populate-comprehensive-zip-data', {
        body: { action: 'get_health_check' }
      });

      if (error) throw error;

      if (data.success) {
        setHealthData(data.healthCheck);
        toast({
          title: "Health Check Complete",
          description: "Database health status updated",
        });
      } else {
        throw new Error(data.error || 'Health check failed');
      }
    } catch (error) {
      console.error('Error running health check:', error);
      toast({
        title: "Error",
        description: `Health check failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearData = async () => {
    if (!confirm('Are you sure you want to clear all comprehensive ZIP data? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('populate-comprehensive-zip-data', {
        body: { action: 'clear_data' }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Data Cleared",
          description: data.message,
        });
        setHealthData(null);
      } else {
        throw new Error(data.error || 'Failed to clear data');
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "Error",
        description: `Failed to clear data: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Excellent</Badge>;
      case 'good':
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" />Good</Badge>;
      case 'fair':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Fair</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  React.useEffect(() => {
    runHealthCheck();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Optimized ZIP Code Data Manager
        </CardTitle>
        <CardDescription>
          Manage comprehensive ZIP code data for performance optimization. Choose between sample data (5 ZIP codes) for testing or bulk import (33,000+ ZIP codes) for production.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Status */}
        {healthData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">ZIP Codes</div>
              <div className="text-2xl font-bold">{healthData.comprehensive_zip_codes}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">ZCTA Polygons</div>
              <div className="text-2xl font-bold">{healthData.comprehensive_zcta_polygons}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Missing Coords</div>
              <div className="text-2xl font-bold">{healthData.missing_coordinates}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Coverage</div>
              <div className="text-2xl font-bold">{healthData.zips_with_coverage}</div>
            </div>
          </div>
        )}

        {/* Health Status Badge */}
        {healthData?.health_status && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Health Status:</span>
            {getHealthStatusBadge(healthData.health_status)}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Quick Test Data */}
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium">Quick Testing (Sample Data)</h4>
            <p className="text-sm text-muted-foreground">Load 5 sample ZIP codes with full metadata for immediate testing</p>
            <Button 
              onClick={loadSampleData} 
              disabled={loading || bulkLoading}
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              {loading ? 'Loading...' : 'Load Sample Data (5 ZIP codes)'}
            </Button>
          </div>

          {/* Production Data */}
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium">Production Data (Bulk Import)</h4>
            <p className="text-sm text-muted-foreground">
              Import all 33,791 US ZIP codes with data enrichment. Includes city, state, coordinates, and timezone data.
            </p>
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span>This process takes 10-15 minutes and uses external APIs for data enrichment</span>
            </div>
            <Button 
              onClick={loadBulkData} 
              disabled={loading || bulkLoading}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              {bulkLoading ? 'Processing Bulk Import...' : 'Load All ZIP Codes (33,791)'}
            </Button>
          </div>

          {/* Utility Actions */}
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              onClick={runHealthCheck} 
              disabled={loading || bulkLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Health Check
            </Button>
            
            <Button 
              variant="destructive" 
              onClick={clearData} 
              disabled={loading || bulkLoading}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear Data
            </Button>
          </div>
        </div>

        {/* Information */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Performance Benefits of Full Data:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Complete US coverage: All 33,791 ZIP codes with enriched metadata</li>
            <li>Instant validation: ZIP code lookup in ~50ms vs 2-5 seconds</li>
            <li>Offline capability: No dependency on external geocoding APIs</li>
            <li>Service area mapping: Perfect coverage calculation for worker assignments</li>
            <li>Enhanced UX: Real-time ZIP validation during booking flow</li>
          </ul>
          
          <p className="mt-4"><strong>Data Sources & Enrichment:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Base ZIP codes: Complete USPS ZIP code registry (33,791 codes)</li>
            <li>Geographic data: Latitude/longitude coordinates via Zippopotam.us API</li>
            <li>Location data: City, state, county information</li>
            <li>Time zones: Accurate timezone mapping by geographic region</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};