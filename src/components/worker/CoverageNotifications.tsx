
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { useWorkerCoverageNotifications } from '@/hooks/useWorkerCoverageNotifications';
import { format } from 'date-fns';

const CoverageNotifications = () => {
  const { 
    notifications, 
    loading, 
    respondToNotification, 
    getPendingNotifications 
  } = useWorkerCoverageNotifications();

  const pendingNotifications = getPendingNotifications();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading coverage requests...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingNotifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Coverage Requests</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">No pending coverage requests</p>
        </CardContent>
      </Card>
    );
  }

  const getDistanceBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge variant="default" className="bg-green-500">Same Area</Badge>;
      case 2:
        return <Badge variant="secondary">Nearby</Badge>;
      case 3:
        return <Badge variant="outline">Regional</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bell className="h-5 w-5" />
          <span>Coverage Requests</span>
          {pendingNotifications.length > 0 && (
            <Badge variant="destructive">{pendingNotifications.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingNotifications.map((notification) => (
          <Card key={notification.id} className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">
                      {notification.booking?.service?.name || 'Service Request'}
                    </h3>
                    {getDistanceBadge(notification.distance_priority)}
                    {notification.notification_type === 'urgent_coverage' && (
                      <Badge variant="destructive">URGENT</Badge>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {format(new Date(notification.sent_at), 'MMM d, h:mm a')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>
                      {notification.booking?.scheduled_date} at {notification.booking?.scheduled_start}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>{notification.booking?.customer?.city || 'Location not specified'}</span>
                  </div>
                </div>

                {notification.booking?.location_notes && (
                  <div className="text-sm text-gray-600">
                    <strong>Notes:</strong> {notification.booking.location_notes}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-green-600">
                    ${notification.booking?.service?.base_price || 0}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => respondToNotification(notification.id, 'declined')}
                      className="flex items-center space-x-1"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Decline</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => respondToNotification(notification.id, 'accepted')}
                      className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Accept</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};

export default CoverageNotifications;
