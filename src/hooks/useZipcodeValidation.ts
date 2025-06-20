
import { useState, useCallback } from 'react';
import { validateUSZipcode } from '@/utils/zipcodeValidation';

interface ZipcodeValidationState {
  isValid: boolean;
  isValidating: boolean;
  error: string | null;
  data: any | null;
}

export const useZipcodeValidation = () => {
  const [state, setState] = useState<ZipcodeValidationState>({
    isValid: false,
    isValidating: false,
    error: null,
    data: null
  });

  const validateZipcode = useCallback(async (zipcode: string) => {
    if (!zipcode || zipcode.length !== 5) {
      setState({
        isValid: false,
        isValidating: false,
        error: 'Zipcode must be 5 digits',
        data: null
      });
      return false;
    }

    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      const zipcodeData = await validateUSZipcode(zipcode);
      
      if (zipcodeData) {
        setState({
          isValid: true,
          isValidating: false,
          error: null,
          data: zipcodeData
        });
        return true;
      } else {
        setState({
          isValid: false,
          isValidating: false,
          error: 'Invalid US zipcode',
          data: null
        });
        return false;
      }
    } catch (error) {
      setState({
        isValid: false,
        isValidating: false,
        error: 'Unable to validate zipcode',
        data: null
      });
      return false;
    }
  }, []);

  return {
    ...state,
    validateZipcode
  };
};
