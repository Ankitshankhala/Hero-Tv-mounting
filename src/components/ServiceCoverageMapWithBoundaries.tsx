import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useComprehensiveZctaBoundaries } from '@/hooks/useComprehensiveZctaBoundaries';
import { useComprehensiveZipcodeValidation } from '@/hooks/useComprehensiveZipValidation';
import { useZctaBoundaries } from '../hooks/useZctaBoundaries';
import { useZipcodeValidation } from '../hooks/useZipcodeValidation';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ServiceCoverageMapWithBoundariesProps {
  onBookingRequested?: (zipcode: string) => void;
  className?: string;
  initialZipcode?: string;
}

export const ServiceCoverageMapWithBoundaries: React.FC<ServiceCoverageMapWithBoundariesProps> = ({
  onBookingRequested,
  className = "",
  initialZipcode
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [zipcode, setZipcode] = useState(initialZipcode || '');
  const [currentBoundary, setCurrentBoundary] = useState<L.GeoJSON | null>(null);
  const [zipInfo, setZipInfo] = useState<any>(null);

  // Try comprehensive system first, fallback to legacy
  const { validateZipcode: validateComprehensive, result: comprehensiveResult } = useComprehensiveZipcodeValidation();
  const { validateZipcode: validateLegacy } = useZipcodeValidation();
  const { addBoundaryToMap: addComprehensiveBoundary, loading: comprehensiveBoundaryLoading } = useComprehensiveZctaBoundaries();
  const { addBoundaryToMap: addLegacyBoundary, loading: legacyBoundaryLoading } = useZctaBoundaries();
  
  const boundaryLoading = comprehensiveBoundaryLoading || legacyBoundaryLoading;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795], // Center of US
      zoom: 4,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Fix Leaflet icon URLs
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

  // Load initial zipcode if provided
  useEffect(() => {
    if (initialZipcode && mapRef.current) {
      handleZipcodeSearch(initialZipcode);
    }
  }, [initialZipcode]);

  const handleZipcodeSearch = async (searchZipcode?: string) => {
    const targetZipcode = searchZipcode || zipcode;
    if (!targetZipcode || !mapRef.current) return;

    try {
      // Clear existing boundary
      if (currentBoundary) {
        mapRef.current.removeLayer(currentBoundary);
        setCurrentBoundary(null);
      }

      // Try comprehensive validation first, fallback to legacy
      let validation;
      try {
        validation = await validateComprehensive(targetZipcode);
        // If comprehensive validation fails, try legacy
        if (!validation.isValid) {
          validation = await validateLegacy(targetZipcode);
        }
      } catch (error) {
        console.warn('Comprehensive validation failed, using legacy:', error);
        validation = await validateLegacy(targetZipcode);
      }
      
      setZipInfo(validation);

      if (!validation.isValid) {
        toast.error('Invalid ZIP code or ZIP code not found');
        return;
      }

      // Try comprehensive boundary first, fallback to legacy
      let boundaryLayer;
      try {
        boundaryLayer = await addComprehensiveBoundary(mapRef.current, targetZipcode, {
          color: validation.hasCoverage ? '#10b981' : '#ef4444',
          weight: 3,
          fillColor: validation.hasCoverage ? '#10b981' : '#ef4444',
          fillOpacity: 0.2
        });
      } catch (error) {
        console.warn('Comprehensive boundary failed, using legacy:', error);
        boundaryLayer = await addLegacyBoundary(mapRef.current, targetZipcode, {
          color: validation.hasServiceCoverage ? '#10b981' : '#ef4444',
          weight: 3,
          fillColor: validation.hasServiceCoverage ? '#10b981' : '#ef4444',
          fillOpacity: 0.2
        });
      }

      if (boundaryLayer) {
        setCurrentBoundary(boundaryLayer);
        
        // Add popup with service info
        const dataSourceBadge = validation.dataSource ? 
          `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 ml-2">
            ${validation.dataSource === 'comprehensive' ? 'Enhanced' : 'Standard'}
          </span>` : '';
          
        const hasCoverage = validation.hasCoverage || validation.hasServiceCoverage;
        const workerCount = validation.workerCount || 0;
        const city = validation.city || validation.locationData?.city;
        const state = validation.state || validation.locationData?.state;
        
        const popupContent = `
          <div class="p-2">
            <h3 class="font-semibold text-lg">${targetZipcode}${dataSourceBadge}</h3>
            <p class="text-sm text-gray-600">${city}, ${state}</p>
            <div class="mt-2">
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                hasCoverage 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }">
                ${hasCoverage ? '✓ Service Available' : '✗ No Service'}
              </span>
            </div>
            ${hasCoverage ? `
              <div class="mt-2">
                <p class="text-xs text-gray-500">${workerCount} technician(s) available</p>
                <button 
                  onclick="window.requestBooking?.('${targetZipcode}')" 
                  class="mt-2 w-full bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  Book Service
                </button>
              </div>
            ` : ''}
          </div>
        `;

        boundaryLayer.bindPopup(popupContent);
        
        // Set up booking callback
        (window as any).requestBooking = (zip: string) => {
          onBookingRequested?.(zip);
        };

        const performanceIndicator = validation.dataSource === 'comprehensive' ? ' (Enhanced Performance)' : '';
        toast.success(`ZIP code ${targetZipcode} boundary loaded successfully${performanceIndicator}`);
      } else {
        toast.error('Could not load boundary data for this ZIP code');
      }
    } catch (error) {
      console.error('Error searching zipcode:', error);
      toast.error('Error loading ZIP code boundary');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleZipcodeSearch();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Controls */}
      <Card className="absolute top-4 left-4 z-[1000] p-4 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center space-x-2 mb-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-sm">ZIP Code Coverage</span>
        </div>
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Enter ZIP code"
            value={zipcode}
            onChange={(e) => setZipcode(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-32"
            maxLength={5}
          />
          <Button
            onClick={() => handleZipcodeSearch()}
            disabled={boundaryLoading || !zipcode}
            size="sm"
          >
            {boundaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {zipInfo && (
          <div className="mt-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">
                {zipInfo.city || zipInfo.locationData?.city}, {zipInfo.state || zipInfo.locationData?.state}
              </span>
              <div className="flex items-center gap-1">
                <span className={`px-2 py-1 rounded text-xs ${
                  (zipInfo.hasCoverage || zipInfo.hasServiceCoverage)
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {(zipInfo.hasCoverage || zipInfo.hasServiceCoverage) ? 'Available' : 'No Service'}
                </span>
                {zipInfo.dataSource && (
                  <span className="px-1 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                    {zipInfo.dataSource === 'comprehensive' ? 'Enhanced' : 'Standard'}
                  </span>
                )}
              </div>
            </div>
            {(zipInfo.hasCoverage || zipInfo.hasServiceCoverage) && (
              <div className="text-gray-500 mt-1">
                {zipInfo.workerCount || 0} technician(s) available
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Map Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-[600px] rounded-lg border"
        style={{ minHeight: '400px' }}
      />

      {/* Legend */}
      <Card className="absolute bottom-4 right-4 z-[1000] p-3 bg-white/95 backdrop-blur-sm">
        <div className="text-xs font-medium mb-2">Service Coverage</div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded border"></div>
            <span className="text-xs">Service Available</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded border"></div>
            <span className="text-xs">No Service</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
