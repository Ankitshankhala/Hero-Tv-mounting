import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateUSZipcode, formatZipcode, clearZipcodeFromCache } from '@/utils/zipcodeValidation';
import { getLocalZipFast } from '@/utils/localZipIndex';
import { getZipServiceAreaInfo, type ServiceAreaInfo } from '@/services/zipcodeService';
interface ZipcodeInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, cityState?: string) => void;
  onValidation?: (isValid: boolean, data?: any) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}
export const ZipcodeInput: React.FC<ZipcodeInputProps> = ({
  id,
  label,
  value,
  onChange,
  onValidation,
  error,
  required,
  placeholder = "12345",
  className,
  disabled
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [cityState, setCityState] = useState('');
  const [validationError, setValidationError] = useState('');
  const [serviceArea, setServiceArea] = useState<ServiceAreaInfo | null>(null);
  useEffect(() => {
    let isStale = false;
    const validateZipcode = async () => {
      if (value.length === 5) {
        // Try instant local lookup first
        console.time(`zipcode-lookup-${value}`);
        const localResult = getLocalZipFast(value);
        if (localResult) {
          // Instant success - set UI immediately
          setValidationStatus('valid');
          setIsValidating(false);
          setValidationError('');
          const locationText = `${localResult.city}, ${localResult.stateAbbr}`;
          setCityState(locationText);
          if (onValidation) {
            onValidation(true, localResult);
          }
          onChange(value, locationText);
          console.timeEnd(`zipcode-lookup-${value}`);

          // Run service area and zipcode lookups in parallel for faster results
          Promise.allSettled([getZipServiceAreaInfo(value), validateUSZipcode(value)]).then(([serviceAreaResult, zipcodeResult]) => {
            if (isStale) return;

            // Prioritize service area display if available
            if (serviceAreaResult.status === 'fulfilled' && serviceAreaResult.value) {
              const info = serviceAreaResult.value;
              setServiceArea(info);
              const workerStatus = info.hasActiveWorker && info.workerName 
                ? info.workerName 
                : 'No worker available';
              const areaText = `${info.areaName} (${workerStatus})`;
              setCityState(areaText);
              onChange(value, areaText);
            } else {
              setServiceArea(null);
              // Keep existing city/state display from local lookup
            }
          }).catch(error => {
            console.error('Parallel lookup error:', error);
            if (!isStale) {
              setServiceArea(null);
            }
          });
          return;
        }

        // Fallback to async lookup if local not available
        setValidationStatus('valid');
        setIsValidating(true);
        setValidationError('');

        // Immediately call validation for format (no loading text)
        if (onValidation) {
          onValidation(true, {
            zipcode: value,
            city: '',
            state: '',
            stateAbbr: ''
          });
        }
        try {
          // Run service area and zipcode lookups in parallel
          const [serviceAreaResult, zipcodeResult] = await Promise.allSettled([getZipServiceAreaInfo(value), validateUSZipcode(value)]);

          // Check if this result is still relevant
          if (isStale) return;

          // Prioritize service area display
          if (serviceAreaResult.status === 'fulfilled' && serviceAreaResult.value) {
            const info = serviceAreaResult.value;
            setServiceArea(info);
            const workerStatus = info.hasActiveWorker && info.workerName 
              ? info.workerName 
              : 'No worker available';
            const areaText = `${info.areaName} (${workerStatus})`;
            setCityState(areaText);
            if (onValidation) {
              onValidation(true, {
                zipcode: value,
                city: info.areaName,
                state: '',
                stateAbbr: ''
              });
            }
            onChange(value, areaText);
          } else if (zipcodeResult.status === 'fulfilled' && zipcodeResult.value) {
            // Fall back to city/state if no service area
            const zipcodeData = zipcodeResult.value;
            const locationText = `${zipcodeData.city}, ${zipcodeData.stateAbbr}`;
            setCityState(locationText);
            setServiceArea(null);
            if (onValidation) {
              onValidation(true, zipcodeData);
            }
            onChange(value, locationText);
          } else {
            // No results from either lookup
            setCityState('');
            setServiceArea(null);
            onChange(value);
          }
        } catch (err) {
          if (isStale) return;
          console.warn('Zipcode lookup failed:', err);
          setCityState('');
          setServiceArea(null);
          onChange(value);
        } finally {
          if (!isStale) {
            setIsValidating(false);
          }
        }
      } else {
        setValidationStatus('idle');
        setCityState('');
        setValidationError('');
        setIsValidating(false);
        setServiceArea(null);
        if (onValidation) {
          onValidation(false);
        }
      }
    };

    // No debounce for 5-digit ZIPs (instant local lookup), slight debounce for others
    const delay = value.length === 5 ? 0 : 300;
    const timeoutId = setTimeout(validateZipcode, delay);
    return () => {
      isStale = true;
      clearTimeout(timeoutId);
    };
  }, [value, onChange, onValidation]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatZipcode(e.target.value);
    onChange(formattedValue);
  };
  const getStatusIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (validationStatus === 'valid') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (validationStatus === 'invalid') {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return <MapPin className="h-4 w-4 text-muted-foreground" />;
  };
  const displayError = error || validationError;
  const hasError = Boolean(displayError);
  return <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className={cn("text-sm font-medium", hasError && "text-destructive", required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
        {label}
      </Label>
      
      <div className="relative">
        <Input id={id} type="text" value={value} onChange={handleChange} placeholder={placeholder} disabled={disabled} maxLength={5} className={cn("pr-10", hasError && "border-destructive focus-visible:ring-destructive", validationStatus === 'valid' && "border-green-500 focus-visible:ring-green-500")} aria-invalid={hasError} aria-describedby={hasError ? `${id}-error` : undefined} />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>
      
      {cityState && <p className="text-sm flex items-center space-x-1 text-gray-50">
          <MapPin className="h-3 w-3" />
          <span className={cn("text-green-600", serviceArea && "font-medium")}>
            {cityState}
          </span>
        </p>}
      
      {hasError && <p id={`${id}-error`} className="text-sm text-destructive flex items-center space-x-1">
          <AlertCircle className="h-3 w-3" />
          <span>{displayError}</span>
        </p>}
      
      {value.length > 0 && value.length < 5 && <p className="text-sm text-muted-foreground">
          Enter a 5-digit US zipcode
        </p>}
    </div>;
};