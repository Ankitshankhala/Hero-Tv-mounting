import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const ZctaDataManager = () => {
  const [isPopulating, setIsPopulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'populating' | 'success' | 'error'>('idle');
  const [stats, setStats] = useState<{
    recordsInserted: number;
    totalRecords: number;
  } | null>(null);

  const populateZctaData = async () => {
    if (!confirm('This will import ~33,000 ZCTA polygon boundaries from zcta2020_web.geojson. Due to function timeout limits, you may need to run this 3-4 times to complete. Each run resumes where it left off. Continue?')) {
      return;
    }

    setIsPopulating(true);
    setStatus('populating');
    setProgress(0);

    try {
      toast.info('Starting ZCTA polygon import...');
      
      // Poll database every 2 seconds for real-time progress
      const pollInterval = setInterval(async () => {
        const { count: currentCount } = await supabase
          .from('us_zcta_polygons')
          .select('*', { count: 'exact', head: true });
        
        const totalExpected = 33791; // From GeoJSON
        const currentProgress = Math.min(Math.round(((currentCount || 0) / totalExpected) * 100), 99);
        
        setProgress(currentProgress);
        setStats({
          recordsInserted: currentCount || 0,
          totalRecords: totalExpected
        });
      }, 2000);

      // Call the import-zcta-data edge function
      const { data, error } = await supabase.functions.invoke('import-zcta-data');

      clearInterval(pollInterval);

      // Final status check
      const { count: finalCount } = await supabase
        .from('us_zcta_polygons')
        .select('*', { count: 'exact', head: true });

      setProgress(100);
      setStats({
        recordsInserted: finalCount || 0,
        totalRecords: 33791
      });

      if (error) {
        // Edge function timed out but may have inserted partial data
        if (error.message?.includes('timeout') || error.message?.includes('FunctionsRelayError')) {
          const percentComplete = Math.round(((finalCount || 0) / 33791) * 100);
          toast.warning(`Import timed out after inserting ${(finalCount || 0).toLocaleString()} records (${percentComplete}%). Click "Populate ZCTA Data" again to continue.`);
          setStatus('idle');
        } else {
          throw error;
        }
      } else if (data?.success) {
        const newlyImported = data.imported || 0;
        const skipped = data.skippedExisting || 0;
        const remaining = data.remainingEstimated || 0;
        
        if (remaining === 0 || finalCount >= 33000) {
          setStatus('success');
          toast.success(`ZCTA import complete! ${finalCount.toLocaleString()} total records in database.`);
        } else if (newlyImported === 0 && skipped > 0) {
          setStatus('idle');
          toast.info(`All records already imported. ${finalCount.toLocaleString()} total ZCTAs in database.`);
        } else {
          setStatus('idle');
          toast.info(`Imported ${newlyImported.toLocaleString()} new ZCTAs (skipped ${skipped.toLocaleString()} existing). ${remaining.toLocaleString()} remaining. Click again to continue.`);
        }
      }
    } catch (error) {
      console.error('Failed to populate ZCTA data:', error);
      setStatus('error');
      toast.error(`Failed to populate ZCTA data: ${error.message}`);
    } finally {
      setIsPopulating(false);
    }
  };

  const checkZctaDataStatus = async () => {
    try {
      // Check us_zcta_polygons table (the one we actually query for spatial intersections)
      const { count: polygonCount } = await supabase
        .from('us_zcta_polygons')
        .select('*', { count: 'exact', head: true });

      setStats({
        recordsInserted: polygonCount || 0,
        totalRecords: 33144 // Expected total ZCTA codes in US
      });

      if ((polygonCount || 0) === 0) {
        setStatus('error');
      } else if ((polygonCount || 0) < 30000) {
        setStatus('idle'); // Partial data
      } else {
        setStatus('success'); // Full dataset
      }
    } catch (error) {
      console.error('Failed to check ZCTA data status:', error);
      setStatus('error');
    }
  };

  React.useEffect(() => {
    checkZctaDataStatus();
  }, []);

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Database className="h-5 w-5" />
          ZCTA Polygon Data Import
        </CardTitle>
        <CardDescription>
          Import US Census Bureau ZCTA (ZIP Code Tabulation Area) boundary polygons for spatial queries
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Database Status:</span>
            {status === 'success' && (
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Populated
              </Badge>
            )}
            {status === 'populating' && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Populating
              </Badge>
            )}
            {status === 'error' && (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Error
              </Badge>
            )}
            {status === 'idle' && (
              <Badge variant="outline">
                <Activity className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            )}
          </div>
          
          {stats && (
            <div className="text-sm text-muted-foreground">
              {stats.recordsInserted.toLocaleString()} / {stats.totalRecords.toLocaleString()} ZCTA polygons imported
            </div>
          )}
        </div>

        {isPopulating && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Importing ZCTA polygons... {progress}% (this may take 5-15 minutes)
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={populateZctaData}
            disabled={isPopulating}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isPopulating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Populating...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Populate ZCTA Data
              </>
            )}
          </Button>
          
          <Button
            onClick={checkZctaDataStatus}
            variant="outline"
            size="sm"
            disabled={isPopulating}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Status
          </Button>
        </div>

        {status === 'error' && stats?.recordsInserted === 0 && (
          <div className="text-xs text-muted-foreground bg-red-50 dark:bg-red-950/10 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <p className="font-medium mb-1 text-red-700 dark:text-red-300">No ZCTA Polygons Found:</p>
            <ul className="space-y-1">
              <li>• The `us_zcta_polygons` table is empty</li>
              <li>• Click "Populate ZCTA Data" to import ~33,000 ZCTA boundaries</li>
              <li>• Import will take 5-15 minutes to complete</li>
              <li>• Required for polygon-based worker assignment</li>
            </ul>
          </div>
        )}

        {status !== 'error' && (
          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/10 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="font-medium mb-1">About ZCTA Polygon Import:</p>
            <ul className="space-y-1">
              <li>• Imports official US Census Bureau ZCTA boundary polygons</li>
              <li>• Enables spatial intersection queries for worker service areas</li>
              <li>• Uses PostGIS spatial indexing for fast performance</li>
              <li>• Required for accurate ZIP code coverage detection</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};