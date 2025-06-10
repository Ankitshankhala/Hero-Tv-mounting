
import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  location?: string;
}

export const useGoogleCalendar = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { toast } = useToast();

  // Check configuration on mount
  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = useCallback(async () => {
    try {
      const credentials = await getGoogleCredentials();
      if (!credentials) {
        setConfigurationError('Google API credentials not configured');
        return false;
      }

      // Check if current domain is authorized
      const currentDomain = window.location.origin;
      const isLocalhost = currentDomain.includes('localhost') || currentDomain.includes('127.0.0.1');
      const isLovablePreview = currentDomain.includes('lovable.app') || currentDomain.includes('lovableproject.com');
      
      if (!isLocalhost && !isLovablePreview) {
        setConfigurationError(`Domain ${currentDomain} may not be authorized in Google Cloud Console`);
        return false;
      }

      setConfigurationError(null);
      return true;
    } catch (error) {
      console.error('Configuration check failed:', error);
      setConfigurationError('Failed to check Google API configuration');
      return false;
    }
  }, []);

  const getGoogleCredentials = useCallback(async () => {
    try {
      const [apiKeyResponse, clientIdResponse] = await Promise.all([
        supabase.functions.invoke('get-secret', {
          body: { name: 'GOOGLE_API_KEY' }
        }),
        supabase.functions.invoke('get-secret', {
          body: { name: 'GOOGLE_CLIENT_ID' }
        })
      ]);

      if (apiKeyResponse.error) {
        console.error('API Key fetch error:', apiKeyResponse.error);
        throw new Error(`Failed to fetch Google API key: ${apiKeyResponse.error.message || 'Unknown error'}`);
      }

      if (clientIdResponse.error) {
        console.error('Client ID fetch error:', clientIdResponse.error);
        throw new Error(`Failed to fetch Google Client ID: ${clientIdResponse.error.message || 'Unknown error'}`);
      }

      if (!apiKeyResponse.data?.value || !clientIdResponse.data?.value) {
        throw new Error('Google credentials are not properly configured in Supabase secrets');
      }

      return {
        apiKey: apiKeyResponse.data.value,
        clientId: clientIdResponse.data.value
      };
    } catch (error) {
      console.error('Error fetching Google credentials:', error);
      return null;
    }
  }, []);

  const initializeGoogleServices = useCallback(async () => {
    try {
      const credentials = await getGoogleCredentials();
      if (!credentials) {
        throw new Error('Google credentials not available');
      }

      // Load Google Identity Services script
      if (!window.google) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
          document.head.appendChild(script);
        });
      }

      // Load Google API script for calendar API calls
      if (!window.gapi) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google API script'));
          document.head.appendChild(script);
        });
      }

      // Initialize Google API client
      await new Promise<void>((resolve, reject) => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: credentials.apiKey,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });

      return credentials;
    } catch (error) {
      console.error('Error initializing Google services:', error);
      throw error;
    }
  }, [getGoogleCredentials]);

  const connectToGoogleCalendar = useCallback(async () => {
    setIsLoading(true);
    try {
      const credentials = await initializeGoogleServices();
      if (!credentials) {
        throw new Error('Failed to initialize Google services');
      }

      // Use Google Identity Services for OAuth
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: credentials.clientId,
        scope: 'https://www.googleapis.com/auth/calendar',
        callback: (response: any) => {
          if (response.error) {
            console.error('OAuth error:', response.error);
            throw new Error(`OAuth failed: ${response.error}`);
          }
          
          setAccessToken(response.access_token);
          setIsConnected(true);
          setConfigurationError(null);
          
          toast({
            title: "Success",
            description: "Connected to Google Calendar",
          });
        },
      });

      // Request access token
      tokenClient.requestAccessToken({ prompt: 'consent' });
      
      return true;
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      
      let errorMessage = "Failed to connect to Google Calendar";
      if (error instanceof Error) {
        if (error.message.includes('popup_blocked')) {
          errorMessage = "Please allow popups for Google sign-in to work";
        } else if (error.message.includes('access_denied')) {
          errorMessage = "Google Calendar access was denied. Please try again and grant permissions";
        } else if (error.message.includes('credentials')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Connection Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [initializeGoogleServices, toast]);

  const makeAuthorizedRequest = useCallback(async (requestFunction: () => Promise<any>) => {
    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Set the access token for the API client
    window.gapi.client.setToken({ access_token: accessToken });
    
    try {
      return await requestFunction();
    } catch (error) {
      // If token expired, try to refresh
      console.error('API request failed:', error);
      throw error;
    }
  }, [accessToken]);

  const createCalendarEvent = useCallback(async (event: CalendarEvent) => {
    if (!isConnected || !accessToken) {
      toast({
        title: "Not Connected",
        description: "Please connect to Google Calendar first",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Validate event data
      if (!event.summary?.trim()) {
        throw new Error('Event title is required');
      }

      if (!event.start?.dateTime || !event.end?.dateTime) {
        throw new Error('Event start and end times are required');
      }

      // Validate date format
      const startDate = new Date(event.start.dateTime);
      const endDate = new Date(event.end.dateTime);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format provided');
      }

      if (startDate >= endDate) {
        throw new Error('Event end time must be after start time');
      }

      const response = await makeAuthorizedRequest(async () => {
        return await window.gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: event
        });
      });

      if (!response.result) {
        throw new Error('Failed to create calendar event - no response data');
      }

      toast({
        title: "Success",
        description: "Event added to Google Calendar",
      });

      return response.result;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      
      let errorMessage = "Failed to create calendar event";
      if (error instanceof Error) {
        if (error.message.includes('insufficient permission')) {
          errorMessage = "Insufficient permissions to create calendar events";
        } else if (error.message.includes('quota')) {
          errorMessage = "Google Calendar API quota exceeded. Please try again later";
        } else if (error.message.includes('invalid')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Event Creation Error",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  }, [isConnected, accessToken, toast, makeAuthorizedRequest]);

  const updateCalendarEvent = useCallback(async (eventId: string, event: CalendarEvent) => {
    if (!isConnected || !accessToken) {
      toast({
        title: "Not Connected",
        description: "Please connect to Google Calendar first",
        variant: "destructive",
      });
      return null;
    }

    try {
      if (!eventId?.trim()) {
        throw new Error('Event ID is required for updating');
      }

      // Validate event data
      if (!event.summary?.trim()) {
        throw new Error('Event title is required');
      }

      if (!event.start?.dateTime || !event.end?.dateTime) {
        throw new Error('Event start and end times are required');
      }

      const response = await makeAuthorizedRequest(async () => {
        return await window.gapi.client.calendar.events.update({
          calendarId: 'primary',
          eventId: eventId,
          resource: event
        });
      });

      if (!response.result) {
        throw new Error('Failed to update calendar event - no response data');
      }

      toast({
        title: "Success",
        description: "Calendar event updated",
      });

      return response.result;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      
      let errorMessage = "Failed to update calendar event";
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          errorMessage = "Calendar event not found. It may have been deleted";
        } else if (error.message.includes('insufficient permission')) {
          errorMessage = "Insufficient permissions to update calendar events";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Event Update Error",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  }, [isConnected, accessToken, toast, makeAuthorizedRequest]);

  const deleteCalendarEvent = useCallback(async (eventId: string) => {
    if (!isConnected || !accessToken) {
      toast({
        title: "Not Connected",
        description: "Please connect to Google Calendar first",
        variant: "destructive",
      });
      return false;
    }

    try {
      if (!eventId?.trim()) {
        throw new Error('Event ID is required for deletion');
      }

      await makeAuthorizedRequest(async () => {
        return await window.gapi.client.calendar.events.delete({
          calendarId: 'primary',
          eventId: eventId
        });
      });

      toast({
        title: "Success",
        description: "Event removed from Google Calendar",
      });

      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      
      let errorMessage = "Failed to delete calendar event";
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          errorMessage = "Calendar event not found. It may have already been deleted";
        } else if (error.message.includes('insufficient permission')) {
          errorMessage = "Insufficient permissions to delete calendar events";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Event Deletion Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  }, [isConnected, accessToken, toast, makeAuthorizedRequest]);

  const disconnectFromGoogleCalendar = useCallback(async () => {
    try {
      if (accessToken && window.google?.accounts?.oauth2) {
        // Revoke the access token
        window.google.accounts.oauth2.revoke(accessToken);
      }
      
      setIsConnected(false);
      setAccessToken(null);
      
      toast({
        title: "Success",
        description: "Disconnected from Google Calendar",
      });
    } catch (error) {
      console.error('Error disconnecting from Google Calendar:', error);
      // Even if disconnect fails, reset the local state
      setIsConnected(false);
      setAccessToken(null);
      
      toast({
        title: "Warning",
        description: "Local session cleared. You may need to revoke access manually in Google settings",
        variant: "destructive",
      });
    }
  }, [accessToken, toast]);

  return {
    isConnected,
    isLoading,
    configurationError,
    connectToGoogleCalendar,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    disconnectFromGoogleCalendar
  };
};
