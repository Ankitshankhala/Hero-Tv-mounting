import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, MapPin } from 'lucide-react';

interface SimplifiedPolygonValidatorProps {
  polygon: Array<{ lat: number; lng: number }> | null;
  onValidationChange?: (isValid: boolean, warnings: string[]) => void;
}

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Simplified polygon validator that only does basic validation
 * without client-side spatial operations
 */
export const SimplifiedPolygonValidator: React.FC<SimplifiedPolygonValidatorProps> = ({
  polygon,
  onValidationChange
}) => {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    warnings: [],
    errors: []
  });

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

  const validatePolygon = (coords: Array<{ lat: number; lng: number }>) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (coords.length < 3) {
      errors.push('Polygon must have at least 3 points');
    }

    // Check for valid coordinates
    const hasInvalidCoords = coords.some(point => 
      isNaN(point.lat) || isNaN(point.lng) ||
      point.lat < -90 || point.lat > 90 ||
      point.lng < -180 || point.lng > 180
    );

    if (hasInvalidCoords) {
      errors.push('Invalid coordinates detected');
    }

    // Check for reasonable area size
    if (coords.length > 100) {
      warnings.push('Large polygon may affect performance');
    }

    setValidation({
      isValid: errors.length === 0,
      warnings,
      errors
    });
  };

  if (!polygon || polygon.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Validation Status */}
      <div className="flex items-center gap-2">
        {validation.isValid ? (
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

        <Badge variant="outline" className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {polygon.length} points
        </Badge>
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
    </div>
  );
};