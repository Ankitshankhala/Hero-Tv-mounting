import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, MapPin, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

  const validatePolygon = async (coords: Array<{ lat: number; lng: number }>) => {
    setLoading(true);
    const warnings: string[] = [];
    const errors: string[] = [];
    let isValid = true;

    try {
      // Basic geometric validation
      if (coords.length < 3) {
        errors.push('Polygon must have at least 3 points');
        isValid = false;
      }

      // Check for self-intersection (basic check)
      if (coords.length >= 3 && hasSelfIntersection(coords)) {
        errors.push('Polygon edges cannot cross each other');
        isValid = false;
      }

      // Calculate area and perimeter
      const area = calculatePolygonArea(coords);
      const perimeter = calculatePolygonPerimeter(coords);

      // Area warnings
      if (area > 10000) { // ~100km x 100km
        warnings.push('Very large service area - consider splitting into smaller regions');
      } else if (area < 1) { // ~1km x 1km
        warnings.push('Small service area - may have limited coverage');
      }

      // Get ZIP code preview if enabled
      let zipCodeCount = 0;
      let zipCodes: string[] = [];

      if (showZipPreview && isValid && coords.length >= 3) {
        try {
          const geoJsonPolygon = {
            type: 'Polygon',
            coordinates: [[
              ...coords.map(point => [point.lng, point.lat]),
              [coords[0].lng, coords[0].lat] // Close polygon
            ]]
          };

          const { data: zipResult, error: zipError } = await supabase.functions.invoke('unified-spatial-operations', {
            body: {
              operation: 'polygon-to-zipcodes',
              polygon: geoJsonPolygon
            }
          });

          if (!zipError && zipResult?.success) {
            zipCodeCount = zipResult.count || 0;
            zipCodes = zipResult.zipcodes || [];

            if (zipCodeCount === 0) {
              warnings.push('No ZIP codes found for this area - check polygon placement');
            } else if (zipCodeCount > 100) {
              warnings.push(`Large coverage area (${zipCodeCount} ZIP codes) - consider optimization`);
            }
          }
        } catch (zipError) {
          warnings.push('Unable to preview ZIP codes - will compute during save');
        }
      }

      setValidation({
        isValid,
        warnings,
        errors,
        stats: {
          area: Math.round(area * 100) / 100,
          perimeter: Math.round(perimeter * 100) / 100,
          zipCodeCount,
          zipCodes: zipCodes.slice(0, 10) // Preview first 10 ZIP codes
        }
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

  // Simple self-intersection check (not comprehensive but catches basic cases)
  const hasSelfIntersection = (coords: Array<{ lat: number; lng: number }>): boolean => {
    if (coords.length < 4) return false;

    for (let i = 0; i < coords.length - 1; i++) {
      for (let j = i + 2; j < coords.length - 1; j++) {
        if (i === 0 && j === coords.length - 2) continue; // Skip adjacent segments
        
        const line1 = [coords[i], coords[i + 1]];
        const line2 = [coords[j], coords[j + 1]];
        
        if (linesIntersect(line1[0], line1[1], line2[0], line2[1])) {
          return true;
        }
      }
    }
    return false;
  };

  const linesIntersect = (
    p1: { lat: number; lng: number },
    p2: { lat: number; lng: number },
    p3: { lat: number; lng: number },
    p4: { lat: number; lng: number }
  ): boolean => {
    const denom = (p4.lng - p3.lng) * (p2.lat - p1.lat) - (p4.lat - p3.lat) * (p2.lng - p1.lng);
    if (denom === 0) return false; // Parallel lines

    const ua = ((p4.lat - p3.lat) * (p1.lng - p3.lng) - (p4.lng - p3.lng) * (p1.lat - p3.lat)) / denom;
    const ub = ((p2.lat - p1.lat) * (p1.lng - p3.lng) - (p2.lng - p1.lng) * (p1.lat - p3.lat)) / denom;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  };

  // Simple area calculation using shoelace formula (approximate for lat/lng)
  const calculatePolygonArea = (coords: Array<{ lat: number; lng: number }>): number => {
    let area = 0;
    const n = coords.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coords[i].lng * coords[j].lat;
      area -= coords[j].lng * coords[i].lat;
    }
    
    return Math.abs(area) / 2 * 111 * 111; // Rough conversion to km²
  };

  // Simple perimeter calculation
  const calculatePolygonPerimeter = (coords: Array<{ lat: number; lng: number }>): number => {
    let perimeter = 0;
    
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      const dlat = coords[j].lat - coords[i].lat;
      const dlng = coords[j].lng - coords[i].lng;
      perimeter += Math.sqrt(dlat * dlat + dlng * dlng) * 111; // Rough km conversion
    }
    
    return perimeter;
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