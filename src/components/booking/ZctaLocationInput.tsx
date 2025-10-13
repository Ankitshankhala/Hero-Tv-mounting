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
    coverageInfo,
    validationData
  } = useZipcodeValidationCompat();

  // Debounced validation
  const triggerValidation = useCallback(async (code: string) => {
    if (!code || code.length < 5) return;
    
    setValidationTriggered(true);
    clearError();
    
    try {
      const result = await validateZipcode(code);
      console.debug('ZIP validation result:', { 
        zipcode: code, 
        isValid: result.isValid, 
        city: result.locationData?.city,
        hasServiceCoverage: result.hasServiceCoverage 
      });
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

  // Auto-validate after user stops typing (fast debounce for instant feedback)
    if (autoValidate && cleanValue.length === 5) {
      const timeout = setTimeout(() => {
        triggerValidation(cleanValue);
      }, 300); // Fast debounce for instant worker display
      setDebounceTimeout(timeout);
    } else if (cleanValue.length < 5) {
      setValidationTriggered(false);
      onValidationChange?.(false, null);
    }
  };

  // Update input when value prop changes (without race condition)
  useEffect(() => {
    if (value !== inputValue && value.length === 5) {
      setInputValue(value);
    }
  }, [value]);

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
    if (!validationTriggered) return 'default';
    
    // Distinguish between invalid ZIP format vs valid ZIP with no coverage
    if (zctaValidation && !zctaValidation.is_valid) return 'invalid';
    if (coverageInfo && coverageInfo.hasActive) return 'valid';
    if (coverageInfo && !coverageInfo.hasActive) return 'valid-no-coverage';
    if (error) return 'unknown';
    
    return 'default';
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
      case 'valid-no-coverage':
        return <AlertTriangle className="h-4 w-4 text-action-warning" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-action-danger" />;
      case 'unknown':
        return <Info className="h-4 w-4 text-muted-foreground" />;
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

      {/* Service Coverage Results - Enhanced messaging */}
      {showDetails && validationTriggered && !isLoading && (
        <div className="mt-3">
          {zctaValidation && !zctaValidation.is_valid && (
            <Alert variant="destructive" className="bg-action-danger/10 border-action-danger/30">
              <XCircle className="h-4 w-4 text-action-danger" />
              <AlertDescription className="text-action-danger">
                <div className="font-semibold mb-1">Invalid ZIP Code</div>
                <div className="text-sm">
                  Please enter a valid 5-digit US ZIP code.
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {zctaValidation && zctaValidation.is_valid && validationData?.hasServiceCoverage && (
            <Alert className="bg-action-success/10 border-action-success/30">
              <CheckCircle className="h-4 w-4 text-action-success" />
              <AlertDescription className="text-action-success">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Service Available!</div>
                    {validationData.workers && validationData.workers.length > 0 && (
                      <div className="text-sm mt-1">
                        {validationData.workers.length === 1 ? (
                          <span>
                            {validationData.workers[0].worker_name || 'Technician'} - {validationData.workers[0].area_name || 'Service Area'}
                          </span>
                        ) : (
                          <div>
                            <div className="font-medium">{validationData.workers.length} technicians available</div>
                            <div className="text-xs mt-1 opacity-90">
                              {validationData.workers
                                .filter((w: any) => w.worker_name)
                                .map((w: any) => w.worker_name)
                                .join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {zctaValidation.data_source === 'worker_assignment' && (
                      <div className="text-xs mt-1 opacity-75">
                        ✓ Verified worker coverage area
                      </div>
                    )}
                  </div>
                  <Users className="h-5 w-5 text-action-success" />
                </div>
              </AlertDescription>
            </Alert>
          )}

          {zctaValidation && zctaValidation.is_valid && validationData && !validationData.hasServiceCoverage && (
            <Alert className="bg-action-warning/10 border-action-warning/30">
              <AlertTriangle className="h-4 w-4 text-action-warning" />
              <AlertDescription className="text-action-warning">
                <div className="font-semibold mb-1">Valid ZIP, Limited Coverage</div>
                <div className="text-sm">
                  Currently outside our service area. You can still book - we'll confirm coverage and assign a worker shortly.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && zctaValidation && zctaValidation.is_valid && (
            <Alert className="bg-muted/50 border-border">
              <Info className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-muted-foreground">
                <div className="font-semibold mb-1">Coverage Check Unavailable</div>
                <div className="text-sm">
                  Please continue with your booking. We'll confirm service availability shortly.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Loading State - Optimistic with ZIP display */}
      {isLoading && (
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          🔍 Checking availability in {inputValue}...
        </div>
      )}
    </div>
  );
};
