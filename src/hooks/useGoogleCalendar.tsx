
import { useState, useCallback } from 'react';
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
  const { toast } = useToast();

  const getGoogleCredentials = useCallback(async () => {
    try {
      const { data: apiKeyData, error: apiKeyError } = await supabase.functions.invoke('get-secret', {
        body: { name: 'GOOGLE_API_KEY' }
      });

      const { data: clientIdData, error: clientIdError } = await supabase.functions.invoke('get-secret', {
        body: { name: 'GOOGLE_CLIENT_ID' }
      });

      if (apiKeyError || clientIdError) {
        throw new Error('Failed to fetch Google credentials');
      }

      return {
        apiKey: apiKeyData?.value,
        clientId: clientIdData?.value
      };
    } catch (error) {
      console.error('Error fetching Google credentials:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Google credentials",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const initializeGoogleCalendar = useCallback(async () => {
    try {
      // Load Google API script if not already loaded
      if (!window.gapi) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      // Load Google Identity Services script
      if (!window.google) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      return true;
    } catch (error) {
      console.error('Error initializing Google Calendar:', error);
      toast({
        title: "Error",
        description: "Failed to initialize Google Calendar",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const connectToGoogleCalendar = useCallback(async () => {
    setIsLoading(true);
    try {
      const credentials = await getGoogleCredentials();
      if (!credentials) return false;

      const initialized = await initializeGoogleCalendar();
      if (!initialized) return false;

      // Initialize the Google API client
      await new Promise((resolve) => {
        window.gapi.load('client:auth2', resolve);
      });

      await window.gapi.client.init({
        apiKey: credentials.apiKey,
        clientId: credentials.clientId,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar'
      });

      const authInstance = window.gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();
      
      if (user.isSignedIn()) {
        setIsConnected(true);
        toast({
          title: "Success",
          description: "Connected to Google Calendar",
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      toast({
        title: "Error",
        description: "Failed to connect to Google Calendar. Please check your credentials.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getGoogleCredentials, initializeGoogleCalendar, toast]);

  const createCalendarEvent = useCallback(async (event: CalendarEvent) => {
    if (!isConnected) {
      toast({
        title: "Error",
        description: "Please connect to Google Calendar first",
        variant: "destructive",
      });
      return null;
    }

    try {
      const response = await window.gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      toast({
        title: "Success",
        description: "Event added to Google Calendar",
      });

      return response.result;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      toast({
        title: "Error",
        description: "Failed to create calendar event",
        variant: "destructive",
      });
      return null;
    }
  }, [isConnected, toast]);

  const updateCalendarEvent = useCallback(async (eventId: string, event: CalendarEvent) => {
    if (!isConnected) return null;

    try {
      const response = await window.gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: event
      });

      toast({
        title: "Success",
        description: "Calendar event updated",
      });

      return response.result;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      toast({
        title: "Error",
        description: "Failed to update calendar event",
        variant: "destructive",
      });
      return null;
    }
  }, [isConnected, toast]);

  const deleteCalendarEvent = useCallback(async (eventId: string) => {
    if (!isConnected) return false;

    try {
      await window.gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });

      toast({
        title: "Success",
        description: "Event removed from Google Calendar",
      });

      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      toast({
        title: "Error",
        description: "Failed to delete calendar event",
        variant: "destructive",
      });
      return false;
    }
  }, [isConnected, toast]);

  const disconnectFromGoogleCalendar = useCallback(async () => {
    try {
      if (window.gapi && window.gapi.auth2) {
        const authInstance = window.gapi.auth2.getAuthInstance();
        await authInstance.signOut();
      }
      setIsConnected(false);
      toast({
        title: "Success",
        description: "Disconnected from Google Calendar",
      });
    } catch (error) {
      console.error('Error disconnecting from Google Calendar:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect from Google Calendar",
        variant: "destructive",
      });
    }
  }, [toast]);

  return {
    isConnected,
    isLoading,
    connectToGoogleCalendar,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    disconnectFromGoogleCalendar
  };
};
