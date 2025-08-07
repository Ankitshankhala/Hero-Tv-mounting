/**
 * Utility functions for phone number formatting and validation
 */

/**
 * Sanitizes and formats a phone number for tel: links
 * Removes special characters and ensures US numbers have +1 prefix
 */
export const formatPhoneForTel = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle empty or invalid phone numbers
  if (digitsOnly.length < 10) return null;
  
  // Handle 10-digit US numbers (add +1 prefix)
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  
  // Handle 11-digit numbers starting with 1 (US numbers)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }
  
  // For other formats, return as-is with + prefix if not present
  return digitsOnly.startsWith('+') ? phone : `+${digitsOnly}`;
};

/**
 * Initiates a phone call using tel: protocol
 * Works on mobile devices to open native dialer
 */
export const initiatePhoneCall = (phone: string | null | undefined): void => {
  const formattedPhone = formatPhoneForTel(phone);
  
  if (!formattedPhone) {
    console.warn('Invalid phone number provided for call');
    return;
  }
  
  // Use window.location.href for better mobile compatibility
  window.location.href = `tel:${formattedPhone}`;
};