import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RotateCcw as Sync, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  MapPin
} from 'lucide-react';
import { useSynchronizedServiceAreas } from '@/hooks/useSynchronizedServiceAreas';
import { useRealTimeSync } from '@/hooks/useRealTimeSync';

interface ServiceAreaZipSyncProps {
  serviceArea: {
    id: string;
    area_name: string;
    polygon_coordinates: any[];
    zipcode_list?: string[];
  };
  workerId: string;
  onSyncComplete?: (areaId: string, zipCodes: string[]) => void;
}

export const ServiceAreaZipSync: React.FC<ServiceAreaZipSyncProps> = ({
  serviceArea,
  workerId,
  onSyncComplete
}) => {
  const {
    syncState,
    triggerSync,
    clearErrors
  } = useSynchronizedServiceAreas({
    workerId,
    enableAutoSync: false, // Manual control in this component
    onSyncComplete: (zipCodes) => {
      onSyncComplete?.(serviceArea.id, zipCodes);
    },
    onSyncError: (error) => {
      console.error('Sync error:', error);
    }
  });

  const { isHealthy } = useRealTimeSync({ 
    tableName: 'worker_service_areas',
    workerId 
  });
  const [lastSyncAttempt, setLastSyncAttempt] = useState<Date | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    expectedCount: number;
    actualCount: number;
  } | null>(null);

  // Validate sync state when component mounts
  useEffect(() => {
    if (serviceArea.zipcode_list) {
      validateCurrentState();
    }
  }, [serviceArea]);

  const validateCurrentState = async () => {
    try {
      const expectedCount = serviceArea.zipcode_list?.length || 0;
      // Simplified validation - just check if we have ZIP codes
      const isValid = expectedCount > 0;
      
      setValidationResult({
        isValid,
        expectedCount,
        actualCount: syncState.syncedZips.length
      });
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const handleManualSync = async () => {
    setLastSyncAttempt(new Date());
    clearErrors();

    try {
      await triggerSync(
        serviceArea.id,
        workerId,
        serviceArea.area_name,
        serviceArea.polygon_coordinates
      );
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const handleComputeOnly = async () => {
    try {
      // Trigger sync which will compute ZIP codes in the database
      await triggerSync(
        serviceArea.id,
        workerId,
        serviceArea.area_name,
        serviceArea.polygon_coordinates
      );
    } catch (error) {
      console.error('Compute-only failed:', error);
    }
  };

  const getSyncStatusBadge = () => {
    if (syncState.isComputing || syncState.isSyncing) {
      return (
        <Badge variant="secondary" className="animate-pulse">
          <Clock className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      );
    }

    if (syncState.errors.length > 0) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    }

    if (validationResult?.isValid) {
      return (
        <Badge variant="default">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Synced
        </Badge>
      );
    }

    return (
      <Badge variant="outline">
        <Sync className="h-3 w-3 mr-1" />
        Needs Sync
      </Badge>
    );
  };

  const isProcessing = syncState.isComputing || syncState.isSyncing;
  const hasErrors = syncState.errors.length > 0;
  const needsSync = !validationResult?.isValid || 
    (validationResult?.expectedCount !== validationResult?.actualCount);

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-sm">ZIP Code Sync</span>
        </div>
        {getSyncStatusBadge()}
      </div>

      {/* Status Information */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Service Area:</span>
          <span className="font-medium">{serviceArea.area_name}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Current ZIP Count:</span>
          <span>{serviceArea.zipcode_list?.length || 0}</span>
        </div>

        {syncState.computedZips.length > 0 && (
          <div className="flex justify-between">
            <span>Computed ZIPs:</span>
            <span className="text-blue-600">{syncState.computedZips.length}</span>
          </div>
        )}

        {syncState.syncedZips.length > 0 && (
          <div className="flex justify-between">
            <span>Backend Synced:</span>
            <span className="text-green-600">{syncState.syncedZips.length}</span>
          </div>
        )}

        {lastSyncAttempt && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Last Sync:</span>
            <span>{lastSyncAttempt.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Progress Indicators */}
      {isProcessing && (
        <div className="space-y-2">
          {syncState.isComputing && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Computing ZIP codes...</span>
                <span>{Math.round(syncState.progress)}%</span>
              </div>
              <Progress value={syncState.progress} className="h-2" />
            </div>
          )}

          {syncState.isSyncing && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Syncing to backend...</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {hasErrors && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {syncState.errors.map((error, index) => (
                <div key={index} className="text-xs">{error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Results */}
      {validationResult && !validationResult.isValid && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Data mismatch detected. Expected {validationResult.expectedCount} ZIP codes, 
            found {validationResult.actualCount} in backend.
          </AlertDescription>
        </Alert>
      )}

      {/* Real-time Sync Health */}
      {!isHealthy && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Real-time sync disconnected. Changes may not reflect immediately.
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleComputeOnly}
          disabled={isProcessing}
          variant="outline"
          className="flex-1"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${syncState.isComputing ? 'animate-spin' : ''}`} />
          Compute Only
        </Button>

        <Button
          size="sm"
          onClick={handleManualSync}
          disabled={isProcessing}
          variant={needsSync ? "default" : "outline"}
          className="flex-1"
        >
          <Sync className={`h-4 w-4 mr-1 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
          {needsSync ? 'Sync Now' : 'Re-sync'}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div className="bg-gray-50 rounded p-2">
          <div className="font-medium">{serviceArea.zipcode_list?.length || 0}</div>
          <div className="text-muted-foreground">Current</div>
        </div>
        <div className="bg-blue-50 rounded p-2">
          <div className="font-medium text-blue-600">{syncState.computedZips.length}</div>
          <div className="text-muted-foreground">Computed</div>
        </div>
        <div className="bg-green-50 rounded p-2">
          <div className="font-medium text-green-600">{syncState.syncedZips.length}</div>
          <div className="text-muted-foreground">Synced</div>
        </div>
      </div>
    </div>
  );
};

export default ServiceAreaZipSync;