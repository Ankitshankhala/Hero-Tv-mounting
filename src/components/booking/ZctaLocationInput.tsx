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

  // Auto-validate after user stops typing (enhanced debouncing)
    if (autoValidate && cleanValue.length === 5) {
      const timeout = setTimeout(() => {
        triggerValidation(cleanValue);
      }, 800); // Increased debounce for better UX
      setDebounceTimeout(timeout);
    } else if (cleanValue.length < 5) {
      setValidationTriggered(false);
      onValidationChange?.(false, null);
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
        'border-action-success bg-background text-foreground': status === 'valid',
        'border-action-danger bg-background text-foreground': status === 'invalid',
        'border-action-info bg-background text-foreground': status === 'loading'
      },
      className
    );
  };

  const getStatusIcon = () => {
    const status = getInputStatus();
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-action-info" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-action-success" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-action-danger" />;
      default:
        return <MapPin className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getDataSourceBadge = (dataSource: string) => {
    const variants: Record<string, { variant: any; label: string; color: string }> = {
      'zcta_boundary': { variant: 'default', label: 'ZCTA Boundary', color: 'bg-action-info/20 text-action-info border border-action-info/30' },
      'postal_only': { variant: 'secondary', label: 'Postal Data', color: 'bg-action-warning/20 text-action-warning border border-action-warning/30' },
      'not_found': { variant: 'destructive', label: 'Not Found', color: 'bg-action-danger/20 text-action-danger border border-action-danger/30' },
      'invalid': { variant: 'destructive', label: 'Invalid', color: 'bg-action-danger/20 text-action-danger border border-action-danger/30' }
    };

    const config = variants[dataSource] || { variant: 'outline', label: dataSource, color: 'bg-muted/50 text-muted-foreground border border-border' };
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
          "border-2 bg-card text-card-foreground",
          zctaValidation.is_valid ? "border-action-success/30" : "border-action-danger/30"
        )}>
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center text-foreground">
                {zctaValidation.is_valid ? (
                  <CheckCircle className="h-4 w-4 text-action-success mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 text-action-danger mr-2" />
                )}
                {zctaValidation.is_valid ? 'Valid ZCTA Code' : 'Invalid ZCTA Code'}
              </h3>
              {getDataSourceBadge(zctaValidation.data_source)}
            </div>

            {/* Location Info */}
            {zctaValidation.is_valid && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-foreground">Location:</span>
                  <div className="text-muted-foreground">{zctaValidation.city}, {zctaValidation.state}</div>
                </div>
                <div>
                  <span className="font-medium text-foreground">Area:</span>
                  <div className="text-muted-foreground">{zctaValidation.total_area_sq_miles.toFixed(1)} sq mi</div>
                </div>
                <div>
                  <span className="font-medium text-foreground">Coordinates:</span>
                  <div className="text-muted-foreground">{zctaValidation.centroid_lat.toFixed(4)}, {zctaValidation.centroid_lng.toFixed(4)}</div>
                </div>
                <div>
                  <span className="font-medium text-foreground">Boundary Data:</span>
                  <div className="text-muted-foreground">{zctaValidation.has_boundary_data ? 'Available' : 'Not Available'}</div>
                </div>
              </div>
            )}

            {/* Service Coverage */}
            {coverageInfo && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {coverageInfo.hasActive ? (
                      <CheckCircle className="h-4 w-4 text-action-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-action-danger" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {coverageInfo.hasActive 
                        ? 'Service Available' 
                        : `No workers available in area ${inputValue}`
                      }
                    </span>
                  </div>
                  {coverageInfo.workerCount > 0 && (
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{coverageInfo.workerCount} worker{coverageInfo.workerCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
                
                {/* No Service Message with Suggestions */}
                {!coverageInfo.hasActive && (
                  <div className="mt-3 p-3 bg-action-warning/10 border border-action-warning/30 rounded">
                    <div className="text-sm text-action-warning font-medium mb-2">
                      Service not available in ZIP code {inputValue}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>• Please check if the ZIP code is correct</p>
                      <p>• Try nearby ZIP codes for available service areas</p>
                      <p>• Contact support if you need service in this area</p>
                    </div>
                  </div>
                )}
                
                {/* Worker Coverage Details */}
                {coverageInfo.hasActive && coverageInfo.workers && coverageInfo.workers.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Available Workers in {zctaValidation?.city}, {zctaValidation?.state}:
                    </div>
                    <div className="space-y-2">
                      {coverageInfo.workers.slice(0, 3).map((worker: any, index: number) => (
                        <div key={worker.id || index} className="bg-muted/50 rounded p-3 border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                                <span className="text-xs font-semibold text-primary">
                                  {worker.name?.charAt(0)?.toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-foreground text-sm">{worker.name}</span>
                                {worker.city && (
                                  <div className="text-xs text-muted-foreground">{worker.city}</div>
                                )}
                              </div>
                            </div>
                            {worker.coverage_source && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                worker.coverage_source === 'zcta' 
                                  ? 'bg-action-info/20 text-action-info border border-action-info/30' 
                                  : 'bg-muted text-muted-foreground border border-border'
                              }`}>
                                {worker.coverage_source === 'zcta' ? 'ZCTA Match' : 'Database'}
                              </span>
                            )}
                          </div>
                          
                          {/* Worker Details */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Service Area:</span>
                              <div className="text-foreground font-medium">
                                {worker.service_area || 'Full coverage area'}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Response Time:</span>
                              <div className="text-foreground font-medium">
                                {worker.avg_response_time || '30-60 mins'}
                              </div>
                            </div>
                          </div>
                          
                          {worker.specializations && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {worker.specializations.slice(0, 3).map((spec: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                                  {spec}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {coverageInfo.workers.length > 3 && (
                        <div className="text-center p-2 bg-muted/30 rounded border border-dashed border-border">
                          <span className="text-xs text-muted-foreground">
                            +{coverageInfo.workers.length - 3} more qualified workers available
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Service Area Capabilities */}
            {zctaValidation.is_valid && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4 text-action-info" />
                    <span className="font-medium text-foreground">Service Area Support:</span>
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

            {/* Enhanced Error Messages */}
            {!zctaValidation.is_valid && (
              <div className="pt-2 border-t border-action-danger/30">
                <div className="p-3 bg-action-danger/10 border border-action-danger/30 rounded">
                  <div className="text-sm text-action-danger font-medium mb-2">
                    Invalid ZIP Code: {inputValue}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Ensure you've entered a valid 5-digit US ZIP code</p>
                    <p>• Double-check for typos or missing digits</p>
                    <p>• Some ZIP codes may not be in our service database yet</p>
                  </div>
                  <div className="mt-2 text-xs text-action-info">
                    <span className="font-medium">Need help?</span> Contact support for assistance with your location.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Validating ZCTA code...
        </div>
      )}
    </div>
  );
};
