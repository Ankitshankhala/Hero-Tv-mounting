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
    setIsPopulating(true);
    setStatus('populating');
    setProgress(0);

    try {
      toast.info('Starting ZCTA data population...');
      
      // Simulate progress during the operation
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Call the populate function
      const { data, error } = await supabase.functions.invoke('populate-zcta-data');

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        throw error;
      }

      if (data.success) {
        setStatus('success');
        setStats({
          recordsInserted: data.recordsInserted,
          totalRecords: data.totalRecords
        });
        toast.success(`ZCTA data populated successfully! ${data.recordsInserted} records processed.`);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
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
      const { data, error } = await supabase
        .from('zcta_zipcodes')
        .select('zcta_code', { count: 'exact' });

      if (!error && data) {
        setStats({
          recordsInserted: data.length,
          totalRecords: data.length
        });
        setStatus(data.length > 0 ? 'success' : 'idle');
      }
    } catch (error) {
      console.error('Failed to check ZCTA data status:', error);
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
          Enhanced ZCTA Database System
        </CardTitle>
        <CardDescription>
          Populate and manage the enhanced ZCTA ZIP code lookup database for improved performance
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
              {stats.totalRecords.toLocaleString()} ZIP codes available
            </div>
          )}
        </div>

        {isPopulating && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Populating ZCTA database... {progress}%
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

        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/10 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="font-medium mb-1">About Enhanced ZCTA System:</p>
          <ul className="space-y-1">
            <li>• Pre-processes all ZCTA polygon data into optimized lookup table</li>
            <li>• Enables fast spatial queries using PostGIS indexing</li>
            <li>• Eliminates client-side processing for better performance</li>
            <li>• Supports reliable worker assignment based on ZIP coverage</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};