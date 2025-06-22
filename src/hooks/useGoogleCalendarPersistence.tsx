
import { useCallback } from 'react';

export const useGoogleCalendarPersistence = () => {
  const validateStoredToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      // Make a simple API call to validate the token
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      
      if (response.ok) {
        const tokenInfo = await response.json();
        // Check if token has required scopes
        return tokenInfo.scope?.includes('https://www.googleapis.com/auth/calendar');
      }
      
      return false;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }, []);

  const clearStoredConnection = useCallback(() => {
    localStorage.removeItem('google_calendar_connection');
    localStorage.removeItem('google_access_token');
  }, []);

  return {
    validateStoredToken,
    clearStoredConnection
  };
};
