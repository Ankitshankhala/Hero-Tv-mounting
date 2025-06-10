
// Google APIs Global Type Definitions
declare global {
  interface Window {
    gapi: GoogleApiClient;
    google: GoogleIdentityServices;
  }
}

// Google API Client (gapi) types
interface GoogleApiClient {
  load: (apis: string, callback: () => void) => void;
  client: {
    init: (config: GoogleGapiConfig) => Promise<void>;
    setToken: (token: { access_token: string }) => void;
    calendar: {
      events: {
        insert: (params: CalendarEventInsertParams) => Promise<GoogleApiResponse>;
        update: (params: CalendarEventUpdateParams) => Promise<GoogleApiResponse>;
        delete: (params: CalendarEventDeleteParams) => Promise<GoogleApiResponse>;
      };
    };
  };
  auth2: {
    getAuthInstance: () => GoogleAuthInstance;
  };
}

// Google Identity Services types
interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient: (config: TokenClientConfig) => TokenClient;
      revoke: (accessToken: string, callback?: () => void) => void;
    };
  };
}

// Configuration interfaces
interface GoogleGapiConfig {
  apiKey: string;
  discoveryDocs: string[];
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
}

// Calendar API interfaces
interface CalendarEventInsertParams {
  calendarId: string;
  resource: CalendarEventResource;
}

interface CalendarEventUpdateParams {
  calendarId: string;
  eventId: string;
  resource: CalendarEventResource;
}

interface CalendarEventDeleteParams {
  calendarId: string;
  eventId: string;
}

interface CalendarEventResource {
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

// Auth interfaces
interface GoogleAuthInstance {
  isSignedIn: () => boolean;
  signIn: () => Promise<GoogleUser>;
  signOut: () => Promise<void>;
}

interface GoogleUser {
  isSignedIn: () => boolean;
}

// API Response interface
interface GoogleApiResponse {
  result: CalendarEventResource;
  status: number;
}

export {};
