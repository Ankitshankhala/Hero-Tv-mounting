import { useState } from 'react';
import { validateBookingIntegrity, logBookingValidationFailure } from '@/utils/bookingValidation';
import { toast } from 'sonner';

export function useBookingValidation() {
  const [validating, setValidating] = useState(false);

  const validateBeforePayment = async (bookingId: string): Promise<boolean> => {
    setValidating(true);
    try {
      const result = await validateBookingIntegrity(bookingId);
      
      if (!result.isValid) {
        // Log the failure
        await logBookingValidationFailure(bookingId, result.errors, 'payment_attempt');
        
        // Show user-friendly error
        toast.error('Booking validation failed', {
          description: 'This booking cannot be processed. Please contact support.',
        });
        
        return false;
      }

      // Show warnings if any
      if (result.warnings.length > 0) {
        console.warn('Booking validation warnings:', result.warnings);
      }

      return true;
    } catch (error) {
      console.error('Error validating booking:', error);
      toast.error('Failed to validate booking');
      return false;
    } finally {
      setValidating(false);
    }
  };

  return {
    validateBeforePayment,
    validating,
  };
}
