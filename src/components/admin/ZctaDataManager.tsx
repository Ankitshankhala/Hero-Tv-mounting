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
    if (!confirm('This will import ~33,791 ZCTA polygon boundaries. We will auto-resume until complete. Continue?')) {
      return;
    }

    setIsPopulating(true);
    setStatus('populating');
    setProgress(0);

    const TOTAL_EXPECTED = 33791;
    const isTransient = (msg: string) => (
      /timeout|FunctionsRelayError|FunctionsFetchError|Failed to fetch|413|Payload Too Large|429|Too Many Requests|5\d{2}|Gateway Timeout/i.test(msg)
    );

    try {
      toast.info('Starting ZCTA polygon import...');

      // Poll database every 2 seconds for real-time progress
      let prevCount = 0;
      const pollInterval = setInterval(async () => {
        const { count: currentCount } = await supabase
          .from('us_zcta_polygons')
          .select('*', { count: 'exact', head: true });

        prevCount = currentCount || prevCount;
        const currentProgress = Math.min(Math.round(((currentCount || 0) / TOTAL_EXPECTED) * 100), 99);
        setProgress(currentProgress);
        setStats({
          recordsInserted: currentCount || 0,
          totalRecords: TOTAL_EXPECTED,
        });
      }, 2000);

      let pass = 0;
      let consecutiveTransient = 0;
      let continueImport = true;
      let sessionTotals = { imported: 0, skipped: 0, invalid: 0, errors: 0 };

      while (continueImport) {
        pass++;
        const { data, error } = await supabase.functions.invoke('import-zcta-data');

        const lastMsg = String(error?.message || data?.lastErrorMessage || '');
        const transient = error ? isTransient(lastMsg) : false;

        // Update session totals if provided
        if (data?.imported) sessionTotals.imported += Number(data.imported);
        if (data?.skippedExisting) sessionTotals.skipped += Number(data.skippedExisting);
        if (data?.invalid) sessionTotals.invalid += Number(data.invalid);
        if (data?.hardErrors ?? data?.errors) sessionTotals.errors += Number(data.hardErrors ?? data.errors);

        // Get current DB count to detect forward progress
        const { count: afterCount } = await supabase
          .from('us_zcta_polygons')
          .select('*', { count: 'exact', head: true });

        const progressed = (afterCount || 0) > prevCount || (Number(data?.imported || 0) > 0);
        prevCount = afterCount || prevCount;

        const remaining = (typeof data?.remainingEstimated === 'number')
          ? data.remainingEstimated
          : (TOTAL_EXPECTED - (afterCount || 0));

        const more = Boolean(data?.moreRemaining) || remaining > 0;

        if (error) {
          if (transient && progressed) {
            consecutiveTransient = 0;
            toast.info(`Pass ${pass}: transient issue but progress observed. Continuing…`);
          } else if (transient) {
            consecutiveTransient++;
            toast.warning(`Pass ${pass}: transient error (${lastMsg || 'network'}). Retrying…`);
            if (consecutiveTransient >= 3) {
              toast.error('Multiple transient errors in a row. Pausing import. You can click again to resume.');
              break;
            }
          } else {
            // Non-transient error: stop this session
            toast.error(`Import error: ${lastMsg || 'Unknown error'}`);
            break;
          }
        } else {
          consecutiveTransient = 0;
          if (data?.imported || data?.skippedExisting) {
            toast.info(`Pass ${pass}: +${Number(data.imported || 0).toLocaleString()} imported • skipped ${Number(data.skippedExisting || 0).toLocaleString()} • ~${Math.max(0, remaining).toLocaleString()} remaining`);
          }
        }

        // Continue if there is more work
        continueImport = more;
        if (!continueImport) break;

        // Small backoff between passes
        const delayMs = Math.min(2000, 500 * pass);
        await new Promise((r) => setTimeout(r, delayMs));
      }

      clearInterval(pollInterval);

      // Final status check
      const { count: finalCount } = await supabase
        .from('us_zcta_polygons')
        .select('*', { count: 'exact', head: true });

      setProgress(Math.min(100, Math.round(((finalCount || 0) / TOTAL_EXPECTED) * 100)));
      setStats({
        recordsInserted: finalCount || 0,
        totalRecords: TOTAL_EXPECTED,
      });

      const remaining = Math.max(0, TOTAL_EXPECTED - (finalCount || 0));
      if (remaining <= 0 || (finalCount || 0) >= 33000) {
        setStatus('success');
        toast.success(`ZCTA import complete! ${Number(finalCount || 0).toLocaleString()} total records.`);
      } else {
        setStatus('idle');
        toast.info(`Session done. Imported ${sessionTotals.imported.toLocaleString()} • skipped ${sessionTotals.skipped.toLocaleString()} • invalid ${sessionTotals.invalid.toLocaleString()} • errors ${sessionTotals.errors.toLocaleString()}. ~${remaining.toLocaleString()} remaining. Click again to resume.`);
      }
    } catch (error: any) {
      console.error('Failed to populate ZCTA data:', error);
      const msg = String(error?.message || error);
      if (isTransient(msg)) {
        setStatus('idle');
        toast.warning('Import ended due to a transient error. Click again to resume.');
      } else {
        setStatus('error');
        toast.error(`Failed to populate ZCTA data: ${msg}`);
      }
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
        totalRecords: 33791
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