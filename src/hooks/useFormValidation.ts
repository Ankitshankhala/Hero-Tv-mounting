
import { useState } from 'react';
import { ValidationPatterns, ValidationMessages, validateField, sanitizeInput } from '@/utils/validation';

interface ValidationRule {
  required?: boolean;
  type?: keyof typeof ValidationPatterns;
  minLength?: number;
  maxLength?: number;
  custom?: (value: string) => boolean;
  customMessage?: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export const useFormValidation = (rules: { [key: string]: ValidationRule }) => {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const validateValue = (fieldName: string, value: string): string => {
    const rule = rules[fieldName];
    if (!rule) return '';

    const sanitizedValue = sanitizeInput(value);

    // Required validation
    if (rule.required && !sanitizedValue) {
      return ValidationMessages.required;
    }

    // Skip other validations if field is empty and not required
    if (!sanitizedValue && !rule.required) {
      return '';
    }

    // Type validation
    if (rule.type && !validateField(sanitizedValue, rule.type)) {
      return ValidationMessages[rule.type];
    }

    // Length validations
    if (rule.minLength && sanitizedValue.length < rule.minLength) {
      return ValidationMessages.minLength(rule.minLength);
    }

    if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
      return ValidationMessages.maxLength(rule.maxLength);
    }

    // Custom validation
    if (rule.custom && !rule.custom(sanitizedValue)) {
      return rule.customMessage || 'Invalid value';
    }

    return '';
  };

  const validateField = (fieldName: string, value: string): boolean => {
    const error = validateValue(fieldName, value);
    setErrors(prev => ({ ...prev, [fieldName]: error }));
    return !error;
  };

  const validateAllFields = (formData: { [key: string]: string }): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    Object.keys(rules).forEach(fieldName => {
      const error = validateValue(fieldName, formData[fieldName] || '');
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const markFieldAsTouched = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };

  const clearErrors = () => {
    setErrors({});
    setTouched({});
  };

  return {
    errors,
    touched,
    validateField,
    validateAllFields,
    markFieldAsTouched,
    clearErrors,
    hasError: (fieldName: string) => Boolean(errors[fieldName] && touched[fieldName])
  };
};
