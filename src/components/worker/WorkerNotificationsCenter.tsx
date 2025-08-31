import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin,
  Calendar,
  DollarSign,
  User
} from 'lucide-react';
import { useWorkerCoverageNotifications } from '@/hooks/useWorkerCoverageNotifications';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function WorkerNotificationsCenter() {
  const { 
    notifications, 
    loading, 
    respondToNotification, 
    getPendingNotifications,
    getNotificationsByResponse
  } = useWorkerCoverageNotifications();
  
  const { toast } = useToast();

  const pendingNotifications = getPendingNotifications();
  const acceptedNotifications = getNotificationsByResponse('accepted');
  const declinedNotifications = getNotificationsByResponse('declined');

  const handleResponse = async (notificationId: string, response: 'accepted' | 'declined') => {
    try {
      await respondToNotification(notificationId, response);
      toast({
        title: response === 'accepted' ? 'Job Request Accepted' : 'Job Request Declined',
        description: `You have ${response} the job request.`,
        variant: response === 'accepted' ? 'default' : 'destructive'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to respond to notification. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const renderNotificationCard = (notification: any, showActions: boolean = false) => (
    <Card key={notification.id} className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            New Job Request
          </CardTitle>
          <div className="flex items-center gap-2">
            {notification.response && (
              <Badge 
                variant={notification.response === 'accepted' ? 'default' : 'destructive'}
                className="text-xs"
              >
                {notification.response}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {format(new Date(notification.created_at), 'MMM d, h:mm a')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground">
            {notification.booking?.users?.email || 'Customer'}
          </span>
        </div>

        {/* Service Info */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="font-medium text-foreground">
            {notification.booking?.booking_services?.[0]?.service_name || 'Service Request'}
          </div>
          
          {/* Location */}
          {notification.booking?.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                {notification.booking.address}
              </span>
            </div>
          )}

          {/* Scheduled Date */}
          {notification.booking?.scheduled_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {format(new Date(notification.booking.scheduled_date), 'EEEE, MMM d, yyyy')}
              </span>
            </div>
          )}

          {/* Amount */}
          {notification.booking?.total_amount && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">
                {formatCurrency(notification.booking.total_amount)}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {showActions && !notification.response && (
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleResponse(notification.id, 'accepted')}
              className="flex-1 bg-action-success hover:bg-action-success/90 text-white"
              disabled={loading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept Job
            </Button>
            <Button
              onClick={() => handleResponse(notification.id, 'declined')}
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              disabled={loading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-40"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-60"></div>
                  <div className="h-4 bg-muted rounded w-40"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        </div>
        {pendingNotifications.length > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {pendingNotifications.length} Pending
          </Badge>
        )}
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="accepted" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Accepted ({acceptedNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="declined" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Declined ({declinedNotifications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <div className="space-y-4">
            {pendingNotifications.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="text-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Pending Notifications</h3>
                  <p className="text-muted-foreground">
                    You'll receive notifications here when customers request your services.
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendingNotifications.map(notification => renderNotificationCard(notification, true))
            )}
          </div>
        </TabsContent>

        <TabsContent value="accepted" className="mt-6">
          <div className="space-y-4">
            {acceptedNotifications.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-action-success mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Accepted Jobs</h3>
                  <p className="text-muted-foreground">
                    Jobs you've accepted will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              acceptedNotifications.map(notification => renderNotificationCard(notification))
            )}
          </div>
        </TabsContent>

        <TabsContent value="declined" className="mt-6">
          <div className="space-y-4">
            {declinedNotifications.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="text-center py-12">
                  <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Declined Jobs</h3>
                  <p className="text-muted-foreground">
                    Jobs you've declined will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              declinedNotifications.map(notification => renderNotificationCard(notification))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}