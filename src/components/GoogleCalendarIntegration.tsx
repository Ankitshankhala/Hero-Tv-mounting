
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Link, Unlink, AlertCircle, ExternalLink } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

interface GoogleCalendarIntegrationProps {
  onConnectionChange?: (connected: boolean) => void;
}

const GoogleCalendarIntegration = ({ onConnectionChange }: GoogleCalendarIntegrationProps) => {
  const {
    isConnected,
    isLoading,
    configurationError,
    connectToGoogleCalendar,
    disconnectFromGoogleCalendar
  } = useGoogleCalendar();

  const handleConnect = async () => {
    const success = await connectToGoogleCalendar();
    if (success && onConnectionChange) {
      onConnectionChange(true);
    }
  };

  const handleDisconnect = async () => {
    await disconnectFromGoogleCalendar();
    if (onConnectionChange) {
      onConnectionChange(false);
    }
  };

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Calendar className="h-5 w-5" />
          <span>Google Calendar Integration</span>
          {isConnected && (
            <Badge variant="default" className="bg-green-600">
              Connected
            </Badge>
          )}
          {configurationError && (
            <Badge variant="destructive">
              Configuration Required
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {configurationError && (
          <Alert className="border-yellow-600 bg-yellow-900/20">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200">
              <strong>Configuration Required:</strong> {configurationError}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-slate-300 text-sm">
          {isConnected 
            ? "Your bookings will be automatically synced with your Google Calendar."
            : "Connect your Google Calendar to automatically sync your bookings and check availability."
          }
        </p>

        {configurationError && (
          <div className="bg-slate-700 p-4 rounded-lg space-y-3">
            <h4 className="text-white font-medium">Setup Required:</h4>
            <div className="text-slate-300 text-sm space-y-2">
              <p><strong>1. Google Cloud Console Setup:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Go to Google Cloud Console → APIs & Credentials</li>
                <li>Create or edit your OAuth 2.0 Client ID</li>
                <li>Add this domain to "Authorized JavaScript origins": <code className="bg-slate-600 px-1 rounded">{currentDomain}</code></li>
                <li>Add this domain to "Authorized redirect URIs": <code className="bg-slate-600 px-1 rounded">{currentDomain}</code></li>
              </ul>
              <p><strong>2. Supabase Secrets:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Set <code className="bg-slate-600 px-1 rounded">GOOGLE_API_KEY</code> in Supabase secrets</li>
                <li>Set <code className="bg-slate-600 px-1 rounded">GOOGLE_CLIENT_ID</code> in Supabase secrets</li>
              </ul>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white"
                onClick={() => window.open('https://console.cloud.google.com/apis/credentials', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Google Console
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-green-400 text-green-400 hover:bg-green-400 hover:text-white"
                onClick={() => window.open('https://supabase.com/dashboard/project/_/settings/vault', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Supabase Secrets
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex space-x-3">
          {!isConnected ? (
            <Button 
              onClick={handleConnect}
              disabled={isLoading || !!configurationError}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Link className="h-4 w-4 mr-2" />
              {isLoading ? "Connecting..." : "Connect Google Calendar"}
            </Button>
          ) : (
            <Button 
              onClick={handleDisconnect}
              variant="outline"
              className="border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
            >
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          )}
        </div>

        {isConnected && (
          <div className="bg-green-900/20 border border-green-700 rounded p-3">
            <p className="text-green-200 text-sm">
              ✓ Your future bookings will automatically appear in your Google Calendar
            </p>
            <p className="text-green-200 text-sm">
              ✓ Booking updates and cancellations will be synced
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarIntegration;
