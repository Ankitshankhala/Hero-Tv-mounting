import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, MapPin, Calculator } from 'lucide-react';
import { useClientSpatialOperations } from '@/utils/clientSpatialOperations';

interface PolygonValidatorProps {
  polygon: Array<{ lat: number; lng: number }> | null;
  onValidationChange?: (isValid: boolean, warnings: string[]) => void;
  showZipPreview?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  stats?: {
    area: number;
    perimeter: number;
    zipCodeCount: number;
    zipCodes: string[];
  };
}

export const PolygonValidator: React.FC<PolygonValidatorProps> = ({
  polygon,
  onValidationChange,
  showZipPreview = true
}) => {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    warnings: [],
    errors: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!polygon || polygon.length === 0) {
      setValidation({ isValid: true, warnings: [], errors: [] });
      return;
    }

    validatePolygon(polygon);
  }, [polygon]);

  useEffect(() => {
    onValidationChange?.(validation.isValid, validation.warnings);
  }, [validation, onValidationChange]);

  const spatialOps = useClientSpatialOperations();

  const validatePolygon = async (coords: Array<{ lat: number; lng: number }>) => {
    setLoading(true);
    
    try {
      console.log('🔍 Starting client-side polygon validation...');
      
      // Use client-side spatial operations for validation
      const validation = spatialOps.validatePolygon(coords);
      let { isValid, errors, warnings, area, perimeter } = validation;

      // Get ZIP code preview if enabled and polygon is valid
      let zipCodeCount = 0;
      let zipCodes: string[] = [];

      if (showZipPreview && isValid && coords.length >= 3) {
        try {
          console.log('🗺️ Loading ZCTA data for ZIP code preview...');
          zipCodes = await spatialOps.getZipcodesFromPolygon(coords, {
            includePartial: true,
            minIntersectionRatio: 0.1
          });
          
          zipCodeCount = zipCodes.length;
          console.log(`✅ Found ${zipCodeCount} ZIP codes using client-side ZCTA data`);

          if (zipCodeCount === 0) {
            warnings.push('No ZIP codes found for this area - check polygon placement');
          } else if (zipCodeCount > 100) {
            warnings.push(`Large coverage area (${zipCodeCount} ZIP codes) - consider optimization`);
          }
        } catch (zipError) {
          console.warn('❌ Client-side ZIP lookup failed:', zipError);
          warnings.push('Unable to preview ZIP codes - will compute during save');
        }
      }

      setValidation({
        isValid,
        warnings,
        errors,
        stats: area && perimeter ? {
          area: Math.round(area * 100) / 100,
          perimeter: Math.round(perimeter * 100) / 100,
          zipCodeCount,
          zipCodes: zipCodes.slice(0, 10) // Preview first 10 ZIP codes
        } : undefined
      });

    } catch (error) {
      console.error('Validation error:', error);
      setValidation({
        isValid: false,
        warnings: [],
        errors: ['Validation failed - please try redrawing the polygon']
      });
    } finally {
      setLoading(false);
    }
  };


  if (!polygon || polygon.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Validation Status */}
      <div className="flex items-center gap-2">
        {loading ? (
          <Badge variant="outline" className="flex items-center gap-1">
            <Calculator className="h-3 w-3 animate-spin" />
            Validating...
          </Badge>
        ) : validation.isValid ? (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Valid Polygon
          </Badge>
        ) : (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Invalid Polygon
          </Badge>
        )}

        {validation.stats && (
          <Badge variant="outline" className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {validation.stats.zipCodeCount} ZIP codes
          </Badge>
        )}
      </div>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {validation.errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {validation.warnings.map((warning, index) => (
                <div key={index}>• {warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      {validation.stats && validation.isValid && (
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Area: ~{validation.stats.area} km²</div>
          <div>Perimeter: ~{validation.stats.perimeter} km</div>
          {validation.stats.zipCodes.length > 0 && (
            <div>
              Sample ZIP codes: {validation.stats.zipCodes.slice(0, 5).join(', ')}
              {validation.stats.zipCodes.length > 5 && ` +${validation.stats.zipCodes.length - 5} more`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};