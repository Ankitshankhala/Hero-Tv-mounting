import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Download, Database, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ImportStatus {
  zip_codes: number;
  zcta_polygons: number;
  estimated_total_zips: number;
  estimated_total_polygons: number;
  coverage_percentage: {
    zip_codes: number;
    polygons: number;
  };
}

interface ImportResult {
  success: boolean;
  message: string;
  total?: number;
  processed?: number;
  errors?: number;
}

export const ComprehensiveZipManager = () => {
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationData, setValidationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadImportStatus();
  }, []);

  const loadImportStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('comprehensive-zip-data-importer', {
        body: { operation: 'get_import_status' }
      });

      if (error) throw error;
      setImportStatus(data);
    } catch (error) {
      console.error('Failed to load import status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportZipCodes = async () => {
    setIsImporting(true);
    setImportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('comprehensive-zip-data-importer', {
        body: { operation: 'import_census_zip_codes' }
      });

      if (error) throw error;
      setImportResult(data);
      await loadImportStatus(); // Refresh status
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        message: 'Import failed: ' + (error as Error).message
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportPolygons = async () => {
    setIsImporting(true);
    setImportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('comprehensive-zip-data-importer', {
        body: { operation: 'import_zcta_polygons' }
      });

      if (error) throw error;
      setImportResult(data);
      await loadImportStatus();
    } catch (error) {
      console.error('Polygon import failed:', error);
      setImportResult({
        success: false,
        message: 'Polygon import failed: ' + (error as Error).message
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleValidateData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('comprehensive-zip-data-importer', {
        body: { operation: 'validate_data' }
      });

      if (error) throw error;
      setValidationData(data);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading import status...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ZIP Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{importStatus?.zip_codes.toLocaleString() || 0}</div>
            <div className="text-xs text-muted-foreground">
              of {importStatus?.estimated_total_zips.toLocaleString()} total
            </div>
            <Progress 
              value={importStatus?.coverage_percentage.zip_codes || 0} 
              className="mt-2" 
            />
            <Badge variant={importStatus?.coverage_percentage.zip_codes === 100 ? "default" : "secondary"} className="mt-2">
              {importStatus?.coverage_percentage.zip_codes || 0}% Coverage
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ZCTA Polygons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{importStatus?.zcta_polygons.toLocaleString() || 0}</div>
            <div className="text-xs text-muted-foreground">
              of {importStatus?.estimated_total_polygons.toLocaleString()} total
            </div>
            <Progress 
              value={importStatus?.coverage_percentage.polygons || 0} 
              className="mt-2" 
            />
            <Badge variant={importStatus?.coverage_percentage.polygons === 100 ? "default" : "secondary"} className="mt-2">
              {importStatus?.coverage_percentage.polygons || 0}% Coverage
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {importStatus?.coverage_percentage.zip_codes === 100 ? (
                <div className="flex items-center text-success">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">ZIP Data Complete</span>
                </div>
              ) : (
                <div className="flex items-center text-warning">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">ZIP Data Incomplete</span>
                </div>
              )}
              
              {importStatus?.coverage_percentage.polygons === 100 ? (
                <div className="flex items-center text-success">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">Polygon Data Complete</span>
                </div>
              ) : (
                <div className="flex items-center text-warning">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">Polygon Data Incomplete</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import">Data Import</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                ZIP Code Data Import
              </CardTitle>
              <CardDescription>
                Import comprehensive US ZIP code data from Census Bureau sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Census Bureau ZIP Codes</h4>
                  <p className="text-sm text-muted-foreground">
                    Import all ~41,000 US ZIP codes with coordinates and metadata
                  </p>
                </div>
                <Button 
                  onClick={handleImportZipCodes}
                  disabled={isImporting}
                  className="ml-4"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Import ZIP Codes
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">ZCTA Polygon Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Import ZIP Code Tabulation Area boundaries for spatial operations
                  </p>
                </div>
                <Button 
                  onClick={handleImportPolygons}
                  disabled={isImporting}
                  variant="outline"
                  className="ml-4"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2" />
                      Import Polygons
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {importResult && (
            <Alert variant={importResult.success ? "default" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {importResult.message}
                {importResult.total && (
                  <div className="mt-2 text-sm">
                    Processed: {importResult.processed}/{importResult.total} 
                    {importResult.errors > 0 && ` (${importResult.errors} errors)`}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Validation</CardTitle>
              <CardDescription>
                Validate imported data quality and coverage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleValidateData} className="mb-4">
                Run Validation
              </Button>

              {validationData && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Sample Data</h4>
                    <div className="bg-muted p-3 rounded text-sm font-mono">
                      <pre>{JSON.stringify(validationData.sample_data, null, 2)}</pre>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">State Distribution</h4>
                    <div className="grid grid-cols-6 gap-2">
                      {Object.entries(validationData.state_distribution || {}).map(([state, count]) => (
                        <Badge key={state} variant="outline">
                          {state}: {count as number}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Status Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>ZIP Codes Imported:</span>
                  <span className="font-mono">{importStatus?.zip_codes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>ZCTA Polygons:</span>
                  <span className="font-mono">{importStatus?.zcta_polygons.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Coverage Goal:</span>
                  <span className="font-mono">
                    {importStatus?.estimated_total_zips.toLocaleString()} ZIP codes, 
                    {importStatus?.estimated_total_polygons.toLocaleString()} polygons
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};