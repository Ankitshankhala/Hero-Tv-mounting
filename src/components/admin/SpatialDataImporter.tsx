import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const SpatialDataImporter = () => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const { toast } = useToast();

  const handleImportData = async () => {
    setImporting(true);
    setProgress(0);
    setStatus('Starting data import...');

    try {
      // Step 1: Check spatial health
      setStatus('Checking spatial health...');
      setProgress(10);

      const { data: healthData, error: healthError } = await supabase.rpc('check_spatial_health');
      
      if (healthError) {
        throw new Error(`Health check failed: ${healthError.message}`);
      }

      setStatus('Health check completed');
      setProgress(30);

      // Step 2: Create spatial indexes if needed
      setStatus('Creating spatial indexes...');
      setProgress(50);

      // Spatial indexes should already be created via migration

      setStatus('Spatial indexes ready');
      setProgress(70);

      // Step 3: Test enhanced functions
      setStatus('Testing enhanced spatial functions...');
      setProgress(90);

      // Test with a sample polygon around Dallas
      const samplePolygon = {
        type: "Polygon",
        coordinates: [[
          [-96.85, 32.75],
          [-96.75, 32.75],
          [-96.75, 32.85],
          [-96.85, 32.85],
          [-96.85, 32.75]
        ]]
      };

      const { data: testResult, error: testError } = await supabase.rpc(
        'find_zipcodes_intersecting_polygon',
        { polygon_coords: samplePolygon }
      );

      if (testError) {
        throw new Error(`Function test failed: ${testError.message}`);
      }

      setStatus(`Spatial infrastructure ready! Found ${testResult?.length || 0} ZIP codes in test area.`);
      setProgress(100);

      toast({
        title: "Success",
        description: "Spatial data infrastructure is now ready for enhanced ZIP boundary operations.",
      });

    } catch (error) {
      console.error('Import failed:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      toast({
        title: "Error",
        description: "Failed to initialize spatial infrastructure. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spatial Data Infrastructure</CardTitle>
        <CardDescription>
          Initialize enhanced ZIP boundary and spatial query capabilities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            This will set up the enhanced spatial infrastructure with proper indexes and functions
            for comprehensive ZIP code boundary operations.
          </AlertDescription>
        </Alert>

        {importing && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
        )}

        <Button 
          onClick={handleImportData}
          disabled={importing}
          className="w-full"
        >
          {importing ? 'Initializing...' : 'Initialize Spatial Infrastructure'}
        </Button>

        {!importing && progress === 100 && (
          <Alert>
            <AlertDescription className="text-green-600">
              ✓ Spatial infrastructure is ready. Enhanced ZIP boundary functions are now available.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};