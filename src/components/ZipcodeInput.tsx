import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useZipcodeSearch } from '@/hooks/useZipcodeSearch';
import { useReverseGeocoding } from '@/hooks/useReverseGeocoding';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, MapPin, Loader2 } from 'lucide-react';

interface ZipcodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onLocationFound?: (city: string, region: string) => void;
  onServiceCoverageFound?: (coverage: { hasServiceCoverage: boolean; workerCount: number; postalCode: string }) => void;
  initialCoordinates?: { lat: number; lng: number };
  placeholder?: string;
  className?: string;
  showLocationButton?: boolean;
}

export const ZipcodeInput = ({ 
  value, 
  onChange, 
  onLocationFound,
  onServiceCoverageFound,
  initialCoordinates,
  placeholder = "Enter your ZIP code",
  className = "",
  showLocationButton = true
}: ZipcodeInputProps) => {
  const { searchZipcode, isLoading, error } = useZipcodeSearch({ 
    onLocationFound: onLocationFound || (() => {}) 
  });

  const { 
    reverseGeocodeCoordinates, 
    isLoading: reverseLoading, 
    error: reverseError,
    postalCode 
  } = useReverseGeocoding({
    onPostalCodeFound: (code) => {
      onChange(code);
      searchZipcode(code);
    },
    onServiceCoverageFound
  });

  const [geoLoading, setGeoLoading] = useState(false);

  // Handle initial coordinates if provided
  useEffect(() => {
    if (initialCoordinates && !value) {
      reverseGeocodeCoordinates(initialCoordinates);
    }
  }, [initialCoordinates, reverseGeocodeCoordinates, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 5);
    onChange(newValue);
    searchZipcode(newValue);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        reverseGeocodeCoordinates(coordinates);
        setGeoLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to retrieve your location. Please enter your ZIP code manually.');
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const isAnyLoading = isLoading || reverseLoading || geoLoading;
  const displayError = error || reverseError;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2">
        <Input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          maxLength={5}
          className="text-center flex-1"
        />
        
        {showLocationButton && (
          <Button
            type="button"
            variant="outline"
            onClick={handleUseCurrentLocation}
            disabled={isAnyLoading}
            className="px-3"
          >
            {geoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      
      {isAnyLoading && (
        <div className="text-sm text-muted-foreground text-center">
          {geoLoading ? 'Getting your location...' : 
           reverseLoading ? 'Finding ZIP code...' : 
           'Looking up ZIP code...'}
        </div>
      )}
      
      {displayError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};