import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  MapPin, 
  Users, 
  Loader2,
  Info
} from 'lucide-react';
import { useZipcodeValidationCompat } from '@/hooks/useZctaBookingIntegration';
import { cn } from '@/lib/utils';

interface ZctaLocationInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, data?: any) => void;
  placeholder?: string;
  className?: string;
  showDetails?: boolean;
  autoValidate?: boolean;
  disabled?: boolean;
}

export const ZctaLocationInput: React.FC<ZctaLocationInputProps> = ({
  value,
  onChange,
  onValidationChange,
  placeholder = "Enter ZIP/ZCTA code (e.g., 75201)",
  className,
  showDetails = true,
  autoValidate = true,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [validationTriggered, setValidationTriggered] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  const {
    validateZipcode,
    isLoading,
    error,
    clearError,
    zctaValidation,
    coverageInfo
  } = useZipcodeValidationCompat();

  // Debounced validation
  const triggerValidation = useCallback(async (code: string) => {
    if (!code || code.length < 5) return;
    
    setValidationTriggered(true);
    clearError();
    
    try {
      const result = await validateZipcode(code);
      onValidationChange?.(result.isValid, result);
    } catch (error) {
      console.error('Validation error:', error);
      onValidationChange?.(false, null);
    }
  }, [validateZipcode, onValidationChange, clearError]);

  // Handle input change
  const handleInputChange = (newValue: string) => {
    // Clean input - only allow digits
    const cleanValue = newValue.replace(/[^\d]/g, '').substring(0, 5);
    setInputValue(cleanValue);
    onChange(cleanValue);

    // Clear previous timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    // Auto-validate after user stops typing
    if (autoValidate && cleanValue.length === 5) {
      const timeout = setTimeout(() => {
        triggerValidation(cleanValue);
      }, 500);
      setDebounceTimeout(timeout);
    } else {
      setValidationTriggered(false);
    }
  };

  // Update input when value prop changes
  useEffect(() => {
    setInputValue(value);
    if (autoValidate && value.length === 5 && value !== inputValue) {
      triggerValidation(value);
    }
  }, [value, triggerValidation, autoValidate, inputValue]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  const getInputStatus = () => {
    if (isLoading) return 'loading';
    if (!validationTriggered || !zctaValidation) return 'default';
    if (zctaValidation.is_valid) return 'valid';
    return 'invalid';
  };

  const getInputClassName = () => {
    const status = getInputStatus();
    return cn(
      'pr-10',
      {
        'border-green-500 bg-green-50': status === 'valid',
        'border-red-500 bg-red-50': status === 'invalid',
        'border-blue-500 bg-blue-50': status === 'loading'
      },
      className
    );
  };

  const getStatusIcon = () => {
    const status = getInputStatus();
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <MapPin className="h-4 w-4 text-gray-400" />;
    }
  };

  const getDataSourceBadge = (dataSource: string) => {
    const variants: Record<string, { variant: any; label: string; color: string }> = {
      'zcta_boundary': { variant: 'default', label: 'ZCTA Boundary', color: 'bg-blue-100 text-blue-800' },
      'postal_only': { variant: 'secondary', label: 'Postal Data', color: 'bg-yellow-100 text-yellow-800' },
      'not_found': { variant: 'destructive', label: 'Not Found', color: 'bg-red-100 text-red-800' },
      'invalid': { variant: 'destructive', label: 'Invalid', color: 'bg-red-100 text-red-800' }
    };

    const config = variants[dataSource] || { variant: 'outline', label: dataSource, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Input Field */}
      <div className="relative">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className={getInputClassName()}
          disabled={disabled}
          maxLength={5}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Validation Results */}
      {showDetails && validationTriggered && zctaValidation && !isLoading && (
        <Card className={cn(
          "border-2",
          zctaValidation.is_valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
        )}>
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center">
                {zctaValidation.is_valid ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mr-2" />
                )}
                {zctaValidation.is_valid ? 'Valid ZCTA Code' : 'Invalid ZCTA Code'}
              </h3>
              {getDataSourceBadge(zctaValidation.data_source)}
            </div>

            {/* Location Info */}
            {zctaValidation.is_valid && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium">Location:</span>
                  <div className="text-gray-700">{zctaValidation.city}, {zctaValidation.state}</div>
                </div>
                <div>
                  <span className="font-medium">Area:</span>
                  <div className="text-gray-700">{zctaValidation.total_area_sq_miles.toFixed(1)} sq mi</div>
                </div>
                <div>
                  <span className="font-medium">Coordinates:</span>
                  <div className="text-gray-700">{zctaValidation.centroid_lat.toFixed(4)}, {zctaValidation.centroid_lng.toFixed(4)}</div>
                </div>
                <div>
                  <span className="font-medium">Boundary Data:</span>
                  <div className="text-gray-700">{zctaValidation.has_boundary_data ? 'Available' : 'Not Available'}</div>
                </div>
              </div>
            )}

            {/* Service Coverage */}
            {coverageInfo && (
              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {coverageInfo.hasActive ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      {coverageInfo.hasActive ? 'Service Available' : 'No Service Coverage'}
                    </span>
                  </div>
                  {coverageInfo.workerCount > 0 && (
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>{coverageInfo.workerCount} worker{coverageInfo.workerCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
                
                {/* Worker Coverage Details */}
                {coverageInfo.hasActive && coverageInfo.workers && coverageInfo.workers.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-gray-600 mb-1">Available Workers:</div>
                    <div className="space-y-1">
                      {coverageInfo.workers.slice(0, 3).map((worker: any, index: number) => (
                        <div key={worker.id || index} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                          <div>
                            <span className="font-medium">{worker.name}</span>
                            {worker.city && <span className="text-gray-500 ml-1">• {worker.city}</span>}
                          </div>
                          {worker.coverage_source && (
                            <span className={`px-2 py-1 rounded text-xs ${
                              worker.coverage_source === 'zcta' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {worker.coverage_source === 'zcta' ? 'ZCTA' : 'Database'}
                            </span>
                          )}
                        </div>
                      ))}
                      {coverageInfo.workers.length > 3 && (
                        <div className="text-xs text-gray-500 italic">
                          +{coverageInfo.workers.length - 3} more workers available
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Service Area Capabilities */}
            {zctaValidation.is_valid && (
              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Service Area Support:</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {zctaValidation.can_use_for_service ? (
                      <Badge variant="default">Supported</Badge>
                    ) : (
                      <Badge variant="secondary">Limited</Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Warnings for invalid codes */}
            {!zctaValidation.is_valid && (
              <div className="pt-2 border-t border-red-200">
                <div className="text-sm text-red-700">
                  <p>This ZCTA code is not recognized. Please verify the code or try a different location.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-4 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Validating ZCTA code...
        </div>
      )}
    </div>
  );
};
