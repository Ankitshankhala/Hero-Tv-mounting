
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Link, Unlink } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

interface GoogleCalendarIntegrationProps {
  onConnectionChange?: (connected: boolean) => void;
}

const GoogleCalendarIntegration = ({ onConnectionChange }: GoogleCalendarIntegrationProps) => {
  const {
    isConnected,
    isLoading,
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
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-slate-300 text-sm">
          {isConnected 
            ? "Your bookings will be automatically synced with your Google Calendar."
            : "Connect your Google Calendar to automatically sync your bookings and check availability."
          }
        </p>
        
        <div className="flex space-x-3">
          {!isConnected ? (
            <Button 
              onClick={handleConnect}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
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
