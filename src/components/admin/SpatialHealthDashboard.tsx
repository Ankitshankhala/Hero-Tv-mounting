import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Database, MapPin, Activity } from 'lucide-react';
import { useSpatialHealthCheck } from '@/hooks/useSpatialHealthCheck';

export const SpatialHealthDashboard = () => {
  const { runHealthCheck, isLoading, healthData } = useSpatialHealthCheck();

  useEffect(() => {
    // Run initial health check on component mount
    runHealthCheck();
  }, [runHealthCheck]);

  const getHealthStatus = () => {
    if (!healthData?.health_data) return { status: 'unknown', color: 'secondary' as const };
    
    const health = healthData.health_data.overall_health;
    if (health === 'healthy') {
      return { status: 'healthy', color: 'default' as const };
    } else if (health === 'degraded_no_polygons') {
      return { status: 'degraded', color: 'destructive' as const };
    } else {
      return { status: 'critical', color: 'destructive' as const };
    }
  };

  const healthStatus = getHealthStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Spatial Health Status
        </CardTitle>
        <CardDescription>
          Monitor ZIP code boundary data and spatial query performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={healthStatus.color}>
              {healthStatus.status.toUpperCase()}
            </Badge>
            {healthData && (
              <span className="text-sm text-muted-foreground">
                Last checked: {new Date().toLocaleTimeString()}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runHealthCheck}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {healthData?.health_data && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">ZCTA Polygons</p>
                <p className="text-xs text-muted-foreground">
                  {healthData.health_data.zcta_polygons_count || 0} records
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">ZIP Codes</p>
                <p className="text-xs text-muted-foreground">
                  {healthData.health_data.us_zip_codes_count || 0} records
                </p>
              </div>
            </div>
          </div>
        )}

        {healthData?.recommendations && healthData.recommendations.length > 0 && (
          <Alert>
            <AlertDescription>
              <strong>Recommendations:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {healthData.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm">{rec}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {!healthData && !isLoading && (
          <Alert>
            <AlertDescription>
              Click refresh to check spatial data health status
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};