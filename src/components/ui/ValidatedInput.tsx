
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhoneNumber, sanitizeInput } from '@/utils/validation';

interface ValidatedInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  autoFormat?: 'phone' | 'name' | 'address';
  disabled?: boolean;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  touched,
  required,
  placeholder,
  className,
  autoFormat,
  disabled
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error && touched);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // Auto-format based on type
    if (autoFormat === 'phone') {
      newValue = formatPhoneNumber(newValue);
    } else if (autoFormat === 'name' || autoFormat === 'address') {
      newValue = sanitizeInput(newValue);
    }

    onChange(newValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) {
      onBlur();
    }
  };

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
          type={type}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "transition-colors",
            hasError && "border-destructive focus-visible:ring-destructive",
            isFocused && !hasError && "border-primary",
            "pr-10"
          )}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
        />
        {hasError && (
          <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-destructive" />
        )}
      </div>
      {hasError && (
        <p id={`${id}-error`} className="text-sm text-destructive flex items-center space-x-1">
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
