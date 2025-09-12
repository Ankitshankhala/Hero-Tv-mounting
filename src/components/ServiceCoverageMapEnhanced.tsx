import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/zipMap.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useZipBoundaries } from '@/hooks/useZipBoundaries';
import { useZipcodeValidation } from '@/hooks/useZipcodeValidation';

interface ServiceCoverageMapEnhancedProps {
  onBookingRequested?: (postalCode: string) => void;
  showZipBoundaries?: boolean;
  className?: string;
}

export const ServiceCoverageMapEnhanced = ({ 
  onBookingRequested, 
  showZipBoundaries = true,
  className = "" 
}: ServiceCoverageMapEnhancedProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [zipInfo, setZipInfo] = useState<any>(null);
  
  const { getNearbyZipBoundaries, loading: boundariesLoading, error } = useZipBoundaries();
  const { validateZipcode } = useZipcodeValidation();

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    mapRef.current = L.map(mapContainerRef.current, {
      center: [32.7767, -96.7970], // Dallas-Fort Worth area
      zoom: 9,
      zoomControl: true
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Fix icon URLs
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !showZipBoundaries) return;

    const loadZipBoundaries = async () => {
      try {
        const center = mapRef.current!.getCenter();
        const boundaries = await getNearbyZipBoundaries(
          center.lat, 
          center.lng, 
          50 // 50km radius
        );

        boundaries.forEach(({ zipcode, boundary_geojson }) => {
          if (boundary_geojson && mapRef.current) {
            const polygon = L.geoJSON(boundary_geojson, {
              style: {
                color: '#3b82f6',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3b82f6',
                fillOpacity: 0.1
              }
            }).addTo(mapRef.current);

            polygon.bindTooltip(zipcode, {
              permanent: false,
              direction: 'center'
            });

            polygon.on('click', async () => {
              setSelectedZip(zipcode);
              const validation = await validateZipcode(zipcode);
              setZipInfo(validation);
            });
          }
        });
      } catch (error) {
        console.error('Failed to load ZIP boundaries:', error);
      }
    };

    loadZipBoundaries();
  }, [showZipBoundaries, getNearbyZipBoundaries, validateZipcode]);

  const handleBookingRequest = () => {
    if (selectedZip && onBookingRequested) {
      onBookingRequested(selectedZip);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainerRef} 
        className="w-full h-96 rounded-lg border border-border bg-card"
      />
      
      {boundariesLoading && (
        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg border">
          Loading ZIP boundaries...
        </div>
      )}

      {error && (
        <div className="absolute top-4 right-4 bg-destructive/90 backdrop-blur-sm px-3 py-2 rounded-lg border text-destructive-foreground text-sm">
          Error loading boundaries: {error}
        </div>
      )}

      {selectedZip && zipInfo && (
        <Card className="absolute bottom-4 left-4 w-80 bg-background/95 backdrop-blur-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-lg mb-2">ZIP Code {selectedZip}</h3>
            
            {zipInfo.isValid && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {zipInfo.location?.city}, {zipInfo.location?.state}
                </p>
                
                {zipInfo.hasServiceCoverage ? (
                  <div>
                    <p className="text-sm text-success font-medium">
                      ✓ Service Available
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {zipInfo.workerCount} worker(s) available
                    </p>
                    <Button 
                      onClick={handleBookingRequest}
                      className="w-full mt-3"
                      size="sm"
                    >
                      Book Service
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-destructive font-medium">
                      ✗ No Service Coverage
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Contact us to request service expansion
                    </p>
                  </div>
                )}
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => setSelectedZip(null)}
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};