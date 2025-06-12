
export const ValidationPatterns = {
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  zipcode: /^\d{5}(-\d{4})?$/,
  name: /^[a-zA-Z\s'-]{2,50}$/,
  address: /^[a-zA-Z0-9\s,.-]{5,100}$/
};

export const ValidationMessages = {
  phone: 'Please enter a valid phone number (e.g., +1234567890 or 1234567890)',
  email: 'Please enter a valid email address',
  zipcode: 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)',
  name: 'Name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes',
  address: 'Address must be 5-100 characters and contain valid address characters',
  required: 'This field is required',
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be no more than ${max} characters`
};

export const validateField = (value: string, type: keyof typeof ValidationPatterns): boolean => {
  if (!value) return false;
  return ValidationPatterns[type].test(value);
};

export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX for US numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // Format with country code +X (XXX) XXX-XXXX
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return value;
};

export const sanitizeInput = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ');
};
