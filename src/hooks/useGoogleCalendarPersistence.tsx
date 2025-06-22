
import { useCallback } from 'react';

const GOOGLE_CALENDAR_STORAGE_KEY = 'google_calendar_connection';
const GOOGLE_ACCESS_TOKEN_KEY = 'google_access_token';

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

  const saveConnection = useCallback((accessToken: string) => {
    try {
      localStorage.setItem(GOOGLE_CALENDAR_STORAGE_KEY, 'true');
      localStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, accessToken);
      console.log('Google Calendar connection saved to localStorage');
    } catch (error) {
      console.error('Failed to save Google Calendar connection:', error);
    }
  }, []);

  const getStoredConnection = useCallback(() => {
    try {
      const isConnected = localStorage.getItem(GOOGLE_CALENDAR_STORAGE_KEY) === 'true';
      const accessToken = localStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY);
      return { isConnected, accessToken };
    } catch (error) {
      console.error('Failed to retrieve stored connection:', error);
      return { isConnected: false, accessToken: null };
    }
  }, []);

  const clearStoredConnection = useCallback(() => {
    try {
      localStorage.removeItem(GOOGLE_CALENDAR_STORAGE_KEY);
      localStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
      console.log('Google Calendar connection cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear stored connection:', error);
    }
  }, []);

  return {
    validateStoredToken,
    saveConnection,
    getStoredConnection,
    clearStoredConnection
  };
};
