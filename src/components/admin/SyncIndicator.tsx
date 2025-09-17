import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  Clock,
  MapPin
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SyncIndicatorProps {
  syncState: {
    isComputing: boolean;
    isSyncing: boolean;
    lastSyncTime: number | null;
    computedZips: string[];
    syncedZips: string[];
    progress: number;
    errors: string[];
  };
  onManualSync?: () => void;
  onClearErrors?: () => void;
  showDetails?: boolean;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  syncState,
  onManualSync,
  onClearErrors,
  showDetails = true
}) => {
  const { 
    isComputing, 
    isSyncing, 
    lastSyncTime, 
    computedZips, 
    syncedZips, 
    progress, 
    errors 
  } = syncState;

  const isActive = isComputing || isSyncing;
  const hasErrors = errors.length > 0;
  const isUpToDate = !hasErrors && computedZips.length > 0 && 
    JSON.stringify(computedZips.sort()) === JSON.stringify(syncedZips.sort());

  const getStatusColor = () => {
    if (hasErrors) return 'destructive';
    if (isActive) return 'default';
    if (isUpToDate) return 'default';
    return 'secondary';
  };

  const getStatusIcon = () => {
    if (hasErrors) return <AlertTriangle className="h-4 w-4" />;
    if (isActive) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (isUpToDate) return <CheckCircle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (hasErrors) return 'Sync Error';
    if (isComputing) return 'Computing ZIP codes...';
    if (isSyncing) return 'Syncing to backend...';
    if (isUpToDate) return 'Synchronized';
    return 'Pending sync';
  };

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant={getStatusColor()} className="flex items-center gap-1">
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
              </span>
            )}
          </div>
          {onManualSync && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onManualSync}
              disabled={isActive}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync
            </Button>
          )}
        </div>

        {/* Progress bar during active operations */}
        {isActive && (
          <div className="mb-3">
            <Progress value={progress} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {progress}% complete
            </div>
          </div>
        )}

        {/* Details section */}
        {showDetails && (
          <div className="space-y-2">
            {/* ZIP code counts */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Computed:</span>
                <Badge variant="outline" className="text-xs">
                  {computedZips.length}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Synced:</span>
                <Badge variant="outline" className="text-xs">
                  {syncedZips.length}
                </Badge>
              </div>
            </div>

            {/* Error messages */}
            {hasErrors && (
              <div className="mt-3 p-2 bg-destructive/10 rounded-md">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-medium text-destructive">
                    Sync Errors ({errors.length})
                  </h4>
                  {onClearErrors && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={onClearErrors}
                      className="h-6 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="text-xs text-destructive space-y-1">
                  {errors.slice(0, 3).map((error, index) => (
                    <div key={index} className="truncate">
                      • {error}
                    </div>
                  ))}
                  {errors.length > 3 && (
                    <div className="text-muted-foreground">
                      +{errors.length - 3} more errors...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success message */}
            {isUpToDate && !hasErrors && computedZips.length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  ZIP codes are synchronized with backend
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};