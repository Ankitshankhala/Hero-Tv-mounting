import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCoordinateServiceCheck } from '@/hooks/useCoordinateServiceCheck';
import { MapPin, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ServiceCoverageMapProps {
  onBookingRequested?: (postalCode: string) => void;
  className?: string;
}

export const ServiceCoverageMap = ({ 
  onBookingRequested, 
  className = "" 
}: ServiceCoverageMapProps) => {
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const { 
    checkServiceAtCoordinates, 
    isLoading, 
    currentResult,
    results 
  } = useCoordinateServiceCheck();

  const handleCoordinateClick = useCallback(async (lat: number, lng: number) => {
    const coordinates = { lat, lng };
    setSelectedCoordinates(coordinates);
    await checkServiceAtCoordinates(coordinates);
  }, [checkServiceAtCoordinates]);

  const handleManualCoordinateInput = () => {
    const lat = parseFloat(prompt('Enter latitude:') || '0');
    const lng = parseFloat(prompt('Enter longitude:') || '0');
    
    if (lat && lng && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      handleCoordinateClick(lat, lng);
    } else {
      alert('Invalid coordinates. Please enter valid latitude (-90 to 90) and longitude (-180 to 180).');
    }
  };

  const handleBookingRequest = () => {
    if (currentResult?.postalCode && currentResult.hasServiceCoverage) {
      onBookingRequested?.(currentResult.postalCode);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Coverage Checker
          </CardTitle>
          <CardDescription>
            Click on a location or enter coordinates to check if TV mounting service is available in that area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual Coordinate Input */}
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={handleManualCoordinateInput}
              disabled={isLoading}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Check Coordinates
            </Button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Checking service coverage...
              </span>
            </div>
          )}

          {/* Current Result */}
          {currentResult && !isLoading && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {currentResult.coordinates.lat.toFixed(6)}, {currentResult.coordinates.lng.toFixed(6)}
                      </span>
                    </div>
                    <Badge variant={currentResult.hasServiceCoverage ? "default" : "secondary"}>
                      {currentResult.hasServiceCoverage ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {currentResult.hasServiceCoverage ? 'Covered' : 'Not Covered'}
                    </Badge>
                  </div>

                  {currentResult.formattedAddress && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Address:</strong> {currentResult.formattedAddress}
                    </div>
                  )}

                  {currentResult.postalCode && (
                    <div className="text-sm">
                      <strong>ZIP Code:</strong> {currentResult.postalCode}
                    </div>
                  )}

                  {currentResult.hasServiceCoverage && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {currentResult.workerCount} worker{currentResult.workerCount !== 1 ? 's' : ''} available
                        </span>
                      </div>
                      
                      <Button 
                        size="sm" 
                        onClick={handleBookingRequest}
                        className="ml-auto"
                      >
                        Book Service
                      </Button>
                    </div>
                  )}

                  {!currentResult.hasServiceCoverage && (
                    <div className="text-sm text-muted-foreground">
                      TV mounting service is not currently available in this area. 
                      Please try a different location or contact us for expansion updates.
                    </div>
                  )}

                  {currentResult.error && (
                    <div className="text-sm text-destructive">
                      <strong>Error:</strong> {currentResult.error}
                    </div>
                  )}

                  {currentResult.provider && (
                    <div className="text-xs text-muted-foreground">
                      Location data from: {currentResult.provider}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Results */}
          {results.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recent Checks</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {results.slice(1, 6).map((result, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 text-xs bg-muted/50 rounded"
                  >
                    <span className="font-mono">
                      {result.coordinates.lat.toFixed(4)}, {result.coordinates.lng.toFixed(4)}
                    </span>
                    <div className="flex items-center gap-2">
                      {result.postalCode && (
                        <span className="text-muted-foreground">{result.postalCode}</span>
                      )}
                      <Badge 
                        variant={result.hasServiceCoverage ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {result.hasServiceCoverage ? 'Covered' : 'Not Covered'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};