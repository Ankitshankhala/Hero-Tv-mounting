import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Map, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  Search,
  ZoomIn
} from 'lucide-react';
import { ZctaLoadProgress } from '@/services/unifiedZctaManager';

interface ZctaControlsProps {
  isReady: boolean;
  isLoading: boolean;
  progress: ZctaLoadProgress | null;
  error: string | null;
  visibleZipcodes: string[];
  onReload: () => void;
  onSearchZipcode?: (zipcode: string) => void;
  onFitToBoundary?: (zipcode: string) => void;
  onToggleBoundaries?: () => void;
  showBoundaries?: boolean;
}

export const ZctaControls: React.FC<ZctaControlsProps> = ({
  isReady,
  isLoading,
  progress,
  error,
  visibleZipcodes,
  onReload,
  onSearchZipcode,
  onFitToBoundary,
  onToggleBoundaries,
  showBoundaries = false
}) => {
  const [searchZip, setSearchZip] = React.useState('');

  const handleSearch = () => {
    if (searchZip.trim()) {
      onSearchZipcode?.(searchZip.trim());
      setSearchZip('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Map className="h-4 w-4 text-purple-600" />
          ZCTA Boundary Controls
        </h3>
        
        <div className="flex items-center gap-2">
          {isReady && (
            <Badge variant="default" className="text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          )}
          
          {error && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Error
            </Badge>
          )}
        </div>
      </div>

      {/* Loading Progress */}
      {isLoading && progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{progress.phase}</span>
            <span>{Math.round(progress.progress)}%</span>
          </div>
          <Progress value={progress.progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{progress.message}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex items-center gap-2 text-red-700 text-xs">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Error loading ZCTA data:</span>
          </div>
          <p className="text-red-600 text-xs mt-1">{error}</p>
        </div>
      )}

      <Separator />

      {/* Main Controls */}
      <div className="space-y-3">
        {/* Boundary Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Show ZIP Boundaries</span>
          <Button
            size="sm"
            variant={showBoundaries ? "default" : "outline"}
            onClick={onToggleBoundaries}
            disabled={!isReady}
          >
            {showBoundaries ? 'Hide' : 'Show'}
          </Button>
        </div>

        {/* ZIP Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Search ZIP Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchZip}
              onChange={(e) => setSearchZip(e.target.value)}
              placeholder="Enter ZIP code..."
              className="flex-1 px-3 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              disabled={!isReady}
            />
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={!isReady || !searchZip.trim()}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReload}
            disabled={isLoading}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Reload Data
          </Button>
        </div>
      </div>

      <Separator />

      {/* Status Information */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Data Status:</span>
          <span className={isReady ? 'text-green-600' : 'text-orange-600'}>
            {isReady ? 'Loaded & Indexed' : 'Not Ready'}
          </span>
        </div>
        
        {visibleZipcodes.length > 0 && (
          <div className="flex justify-between">
            <span>Visible ZIP Codes:</span>
            <Badge variant="outline" className="text-xs">
              {visibleZipcodes.length}
            </Badge>
          </div>
        )}

        {showBoundaries && isReady && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mt-2">
            <p className="text-blue-700 text-xs">
              💡 ZIP boundaries shown at zoom level 11+. 
              {visibleZipcodes.length > 50 && ' Performance limited to 50 boundaries.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZctaControls;