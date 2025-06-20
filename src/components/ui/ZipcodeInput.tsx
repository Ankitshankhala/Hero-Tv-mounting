
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateUSZipcode, formatZipcode } from '@/utils/zipcodeValidation';

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

  useEffect(() => {
    const validateZipcode = async () => {
      if (value.length === 5) {
        setIsValidating(true);
        setValidationError('');
        
        try {
          const zipcodeData = await validateUSZipcode(value);
          
          if (zipcodeData) {
            setValidationStatus('valid');
            const locationText = `${zipcodeData.city}, ${zipcodeData.stateAbbr}`;
            setCityState(locationText);
            
            if (onValidation) {
              onValidation(true, zipcodeData);
            }
            
            // Auto-fill city/state if onChange callback supports it
            onChange(value, locationText);
          } else {
            setValidationStatus('invalid');
            setCityState('');
            setValidationError('Invalid US zipcode');
            
            if (onValidation) {
              onValidation(false);
            }
          }
        } catch (err) {
          setValidationStatus('invalid');
          setCityState('');
          setValidationError('Unable to validate zipcode');
          
          if (onValidation) {
            onValidation(false);
          }
        } finally {
          setIsValidating(false);
        }
      } else {
        setValidationStatus('idle');
        setCityState('');
        setValidationError('');
        
        if (onValidation) {
          onValidation(false);
        }
      }
    };

    // Debounce validation
    const timeoutId = setTimeout(validateZipcode, 500);
    return () => clearTimeout(timeoutId);
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

  return (
    <div className={cn("space-y-2", className)}>
      <Label 
        htmlFor={id} 
        className={cn(
          "text-sm font-medium",
          hasError && "text-destructive",
          required && "after:content-['*'] after:ml-0.5 after:text-destructive"
        )}
      >
        {label}
      </Label>
      
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={5}
          className={cn(
            "pr-10",
            hasError && "border-destructive focus-visible:ring-destructive",
            validationStatus === 'valid' && "border-green-500 focus-visible:ring-green-500"
          )}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
        />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>
      
      {cityState && (
        <p className="text-sm text-muted-foreground flex items-center space-x-1">
          <MapPin className="h-3 w-3" />
          <span>{cityState}</span>
        </p>
      )}
      
      {hasError && (
        <p id={`${id}-error`} className="text-sm text-destructive flex items-center space-x-1">
          <AlertCircle className="h-3 w-3" />
          <span>{displayError}</span>
        </p>
      )}
      
      {value.length > 0 && value.length < 5 && (
        <p className="text-sm text-muted-foreground">
          Enter a 5-digit US zipcode
        </p>
      )}
    </div>
  );
};
