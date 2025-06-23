
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, MapPin, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CoverageRequest {
  booking_id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes: string;
  status: string;
  customer: {
    name: string;
    city: string;
  };
  service: {
    name: string;
    base_price: number;
  };
  notifications: Array<{
    id: string;
    worker: {
      name: string;
      phone: string;
    };
    response: string | null;
    distance_priority: number;
    sent_at: string;
  }>;
}

export const CoverageRequestsManager = () => {
  const [coverageRequests, setCoverageRequests] = useState<CoverageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCoverageRequests = async () => {
    try {
      setLoading(true);
      
      // Get bookings that have coverage notifications
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, city),
          service:services!service_id(name, base_price),
          worker_coverage_notifications(
            *,
            worker:users!worker_id(name, phone)
          )
        `)
        .not('worker_coverage_notifications', 'is', null)
        .eq('status', 'pending')
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const formattedRequests = (data || []).map(booking => ({
        booking_id: booking.id,
        scheduled_date: booking.scheduled_date,
        scheduled_start: booking.scheduled_start,
        location_notes: booking.location_notes,
        status: booking.status,
        customer: booking.customer,
        service: booking.service,
        notifications: booking.worker_coverage_notifications || []
      }));

      setCoverageRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching coverage requests:', error);
      toast({
        title: "Error",
        description: "Failed to load coverage requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendUrgentCoverage = async (bookingId: string) => {
    try {
      const response = await fetch('/functions/v1/notify-workers-coverage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          urgent: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send urgent coverage');
      }

      toast({
        title: "Urgent Coverage Sent",
        description: "Urgent notifications sent to available workers",
      });

      await fetchCoverageRequests();
    } catch (error) {
      console.error('Error sending urgent coverage:', error);
      toast({
        title: "Error",
        description: "Failed to send urgent coverage notifications",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchCoverageRequests();
  }, []);

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

  const getResponseStats = (notifications: any[]) => {
    const total = notifications.length;
    const responded = notifications.filter(n => n.response).length;
    const accepted = notifications.filter(n => n.response === 'accepted').length;
    const declined = notifications.filter(n => n.response === 'declined').length;
    
    return { total, responded, accepted, declined };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bell className="h-5 w-5" />
          <span>Coverage Requests</span>
          {coverageRequests.length > 0 && (
            <Badge variant="secondary">{coverageRequests.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {coverageRequests.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No active coverage requests</p>
        ) : (
          coverageRequests.map((request) => {
            const stats = getResponseStats(request.notifications);
            
            return (
              <Card key={request.booking_id} className="border-orange-200">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {request.service?.name} - {request.customer?.name}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{request.scheduled_date} at {request.scheduled_start}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-4 w-4" />
                            <span>{request.customer?.city}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          ${request.service?.base_price}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendUrgentCoverage(request.booking_id)}
                          className="mt-2"
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Send Urgent
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          {stats.total} workers notified
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Badge variant="outline">
                          {stats.responded}/{stats.total} responded
                        </Badge>
                        {stats.accepted > 0 && (
                          <Badge className="bg-green-500">
                            {stats.accepted} accepted
                          </Badge>
                        )}
                        {stats.declined > 0 && (
                          <Badge variant="secondary">
                            {stats.declined} declined
                          </Badge>
                        )}
                      </div>
                    </div>

                    {request.notifications.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Worker Responses:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {request.notifications.map((notification) => (
                            <div key={notification.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                              <span>{notification.worker?.name}</span>
                              <div className="flex items-center space-x-2">
                                <Badge
                                  variant={
                                    notification.distance_priority === 1 ? "default" :
                                    notification.distance_priority === 2 ? "secondary" : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {notification.distance_priority === 1 ? "Same" : 
                                   notification.distance_priority === 2 ? "Nearby" : "Regional"}
                                </Badge>
                                {notification.response ? (
                                  <Badge
                                    variant={notification.response === 'accepted' ? "default" : "secondary"}
                                    className={notification.response === 'accepted' ? "bg-green-500" : ""}
                                  >
                                    {notification.response}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Pending</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
