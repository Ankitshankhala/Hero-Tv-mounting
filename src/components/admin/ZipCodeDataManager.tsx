import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Map, 
  BarChart3,
  RefreshCw,
  Trash2,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LoadProgress {
  zipcodesLoaded: number;
  polygonsLoaded: number;
  totalExpectedZipcodes: number;
  totalExpectedPolygons: number;
  completionPercentage: {
    zipcodes: number;
    polygons: number;
  };
}

interface ValidationResults {
  zipcodesCount: number;
  zctaPolygonsCount: number;
  spatialTestSuccess: boolean;
  spatialTestResults?: any;
  recommendedActions: string[];
}

interface LoadResult {
  success: boolean;
  zipcodesLoaded: number;
  polygonsLoaded: number;
  errors: string[];
  validationResults?: ValidationResults;
}

export const ZipCodeDataManager = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [validation, setValidation] = useState<ValidationResults | null>(null);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  useEffect(() => {
    loadProgress();
    runValidation();
  }, []);

  const loadProgress = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('load-complete-zipcode-data', {
        body: { action: 'get_progress' }
      });

      if (error) throw error;
      setProgress(data);
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  };

  const runValidation = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('load-complete-zipcode-data', {
        body: { action: 'validate_data' }
      });

      if (error) throw error;
      setValidation(data);
    } catch (error) {
      console.error('Failed to run validation:', error);
    }
  };

  const loadSampleData = async () => {
    setLoading(true);
    try {
      toast({
        title: "Loading ZIP Code Data",
        description: "Starting comprehensive dataset load...",
      });

      const { data, error } = await supabase.functions.invoke('load-complete-zipcode-data', {
        body: { 
          action: 'load_sample_data',
          testMode: false 
        }
      });

      if (error) throw error;

      setLoadResult(data);
      
      if (data.success) {
        toast({
          title: "Data Load Successful",
          description: `Loaded ${data.zipcodesLoaded} ZIP codes and ${data.polygonsLoaded} ZCTA polygons`,
        });
      } else {
        toast({
          title: "Data Load Completed with Issues",
          description: `${data.errors?.length || 0} errors encountered`,
          variant: "destructive",
        });
      }

      // Refresh progress and validation
      await loadProgress();
      await runValidation();
      
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: "Data Load Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('load-complete-zipcode-data', {
        body: { action: 'clear_data' }
      });

      if (error) throw error;

      toast({
        title: "Data Cleared",
        description: "All ZIP code and ZCTA data has been removed",
      });

      // Refresh progress and validation
      await loadProgress();
      await runValidation();
      setLoadResult(null);
      
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast({
        title: "Clear Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatus = () => {
    if (!validation) return { status: 'unknown', color: 'secondary' };
    
    const zipComplete = validation.zipcodesCount > 30000;
    const zctaComplete = validation.zctaPolygonsCount > 1000;
    const spatialWorking = validation.spatialTestSuccess;
    
    if (zipComplete && zctaComplete && spatialWorking) {
      return { status: 'healthy', color: 'default' };
    } else if (validation.zipcodesCount > 0 && validation.zctaPolygonsCount > 0) {
      return { status: 'partial', color: 'secondary' };
    } else {
      return { status: 'critical', color: 'destructive' };
    }
  };

  const health = getHealthStatus();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            ZIP Code Data Manager
          </CardTitle>
          <CardDescription>
            Manage comprehensive US ZIP code points and Census Bureau ZCTA polygon data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="load">Load Data</TabsTrigger>
              <TabsTrigger value="testing">Testing</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">ZIP Codes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {progress?.zipcodesLoaded?.toLocaleString() || '0'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      of 41,000+ expected
                    </p>
                    {progress && (
                      <Progress 
                        value={progress.completionPercentage.zipcodes} 
                        className="mt-2" 
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">ZCTA Polygons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {progress?.polygonsLoaded?.toLocaleString() || '0'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      of 33,000+ expected
                    </p>
                    {progress && (
                      <Progress 
                        value={progress.completionPercentage.polygons} 
                        className="mt-2" 
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">System Health</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant={health.color as "default" | "destructive" | "secondary" | "outline"}>
                        {health.status}
                      </Badge>
                      {validation?.spatialTestSuccess ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Spatial queries {validation?.spatialTestSuccess ? 'working' : 'limited'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {validation?.recommendedActions && validation.recommendedActions.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Recommendations:</p>
                      {validation.recommendedActions.map((action, index) => (
                        <p key={index} className="text-sm">• {action}</p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="load" className="space-y-4">
              <div className="space-y-4">
                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertDescription>
                    This will load a comprehensive sample dataset including ZIP code points and Census ZCTA polygon boundaries.
                    For production use, you'll need to source the complete Census Bureau TIGER/Line shapefiles.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button 
                    onClick={loadSampleData} 
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Load Sample Dataset
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={clearData} 
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All Data
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={() => {
                      loadProgress();
                      runValidation();
                    }} 
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>

                {loadResult && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Load Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {loadResult.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">
                            {loadResult.success ? 'Success' : 'Completed with errors'}
                          </span>
                        </div>
                        <p>ZIP Codes Loaded: {loadResult.zipcodesLoaded}</p>
                        <p>ZCTA Polygons Loaded: {loadResult.polygonsLoaded}</p>
                        
                        {loadResult.errors && loadResult.errors.length > 0 && (
                          <div className="mt-4">
                            <p className="font-medium text-red-600">Errors:</p>
                            <ScrollArea className="h-32 mt-2">
                              {loadResult.errors.map((error, index) => (
                                <p key={index} className="text-sm text-red-600">• {error}</p>
                              ))}
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="testing" className="space-y-4">
              <Alert>
                <Map className="h-4 w-4" />
                <AlertDescription>
                  Test spatial functionality by drawing areas on the service area manager and verifying ZIP code coverage.
                </AlertDescription>
              </Alert>

              {validation?.spatialTestResults && (
                <Card>
                  <CardHeader>
                    <CardTitle>Spatial Test Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {validation.spatialTestSuccess ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span>PostGIS Status: {validation.spatialTestSuccess ? 'Working' : 'Limited'}</span>
                      </div>
                      
                      {validation.spatialTestResults.health_data && (
                        <div className="text-sm space-y-1">
                          <p>Overall Health: {validation.spatialTestResults.health_data.overall_health}</p>
                          <p>PostGIS Version: {validation.spatialTestResults.health_data.postgis_version || 'Unknown'}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="health" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Data Completeness</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>ZIP Codes</span>
                        <span>{progress?.completionPercentage.zipcodes || 0}%</span>
                      </div>
                      <Progress value={progress?.completionPercentage.zipcodes || 0} className="mt-1" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>ZCTA Polygons</span>
                        <span>{progress?.completionPercentage.polygons || 0}%</span>
                      </div>
                      <Progress value={progress?.completionPercentage.polygons || 0} className="mt-1" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">System Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Database Connection</span>
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span>PostGIS Extension</span>
                        <Badge variant={validation?.spatialTestSuccess ? "default" : "secondary"}>
                          {validation?.spatialTestSuccess ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {validation?.spatialTestSuccess ? 'Working' : 'Limited'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span>Spatial Queries</span>
                        <Badge variant={validation?.spatialTestSuccess ? "default" : "destructive"}>
                          {validation?.spatialTestSuccess ? 'Functional' : 'Error'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ZipCodeDataManager;