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
    if (!validationTriggered || !coverageInfo) return 'default';
    if (coverageInfo.hasActive) return 'valid';
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

      {/* Service Coverage Results */}
      {showDetails && validationTriggered && coverageInfo && !isLoading && (
        <Card className={cn(
          "border-2 bg-card text-card-foreground",
          coverageInfo.hasActive ? "border-action-success/30" : "border-action-danger/30"
        )}>
          <CardContent className="p-4 space-y-3">
            {/* Service Coverage Status */}
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
                    : 'No workers available in this area'
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
            
            {/* No Service Message */}
            {!coverageInfo.hasActive && (
              <div className="p-3 bg-action-warning/10 border border-action-warning/30 rounded">
                <div className="text-sm text-action-warning font-medium">
                  No workers available in ZIP code {inputValue}
                </div>
              </div>
            )}
            
            {/* Available Workers */}
            {coverageInfo.hasActive && coverageInfo.workers && coverageInfo.workers.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Available Workers:
                </div>
                <div className="space-y-2">
                  {coverageInfo.workers.slice(0, 2).map((worker: any, index: number) => (
                    <div key={worker.id || index} className="bg-muted/50 rounded p-3 border border-border">
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
                    </div>
                  ))}
                  {coverageInfo.workers.length > 2 && (
                    <div className="text-center p-2 bg-muted/30 rounded border border-dashed border-border">
                      <span className="text-xs text-muted-foreground">
                        +{coverageInfo.workers.length - 2} more workers available
                      </span>
                    </div>
                  )}
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
          Checking service availability...
        </div>
      )}
    </div>
  );
};
