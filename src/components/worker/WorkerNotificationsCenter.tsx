import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Bell, 
  Check, 
  Clock, 
  AlertCircle, 
  Calendar,
  DollarSign,
  MessageSquare,
  Settings,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'job_assigned' | 'schedule_change' | 'payment_update' | 'system_update' | 'message';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  booking_id?: string;
  priority: 'low' | 'medium' | 'high';
}

interface NotificationSettings {
  jobAssignments: boolean;
  scheduleChanges: boolean;
  paymentUpdates: boolean;
  systemUpdates: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export function WorkerNotificationsCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    jobAssignments: true,
    scheduleChanges: true,
    paymentUpdates: true,
    systemUpdates: false,
    emailNotifications: true,
    smsNotifications: true,
  });
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      // Mock notifications - in real app, fetch from database
      const mockNotifications: Notification[] = [
        {
          id: '1',
          type: 'job_assigned',
          title: 'New Job Assigned',
          message: 'TV mounting job scheduled for tomorrow at 2:00 PM. Customer: John Smith, Address: 123 Main St.',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          read: false,
          booking_id: 'booking_1',
          priority: 'high'
        },
        {
          id: '2',
          type: 'schedule_change',
          title: 'Schedule Update Confirmed',
          message: 'Your availability for next week has been updated successfully. You are now available Monday-Friday, 9 AM - 5 PM.',
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          read: false,
          priority: 'medium'
        },
        {
          id: '3',
          type: 'payment_update',
          title: 'Payment Captured',
          message: 'Payment of $150.00 has been successfully captured for your completed job. Funds will be transferred to your account within 2-3 business days.',
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          read: true,
          priority: 'low'
        },
        {
          id: '4',
          type: 'system_update',
          title: 'App Update Available',
          message: 'A new version of the worker app is available with improved features and bug fixes.',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          read: true,
          priority: 'low'
        },
        {
          id: '5',
          type: 'message',
          title: 'Customer Message',
          message: 'Customer for job #12345 has sent a message: "Will you be able to arrive 30 minutes earlier?"',
          created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          read: false,
          priority: 'medium'
        }
      ];

      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'job_assigned':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'schedule_change':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'payment_update':
        return <DollarSign className="h-5 w-5 text-green-500" />;
      case 'system_update':
        return <AlertCircle className="h-5 w-5 text-purple-500" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-pink-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-orange-500';
      case 'low':
        return 'border-l-green-500';
      default:
        return 'border-l-gray-300';
    }
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = async () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const deleteNotification = async (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (activeTab) {
      case 'unread':
        return !notification.read;
      case 'jobs':
        return notification.type === 'job_assigned' || notification.type === 'schedule_change';
      case 'payments':
        return notification.type === 'payment_update';
      default:
        return true;
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // In real app, save to database
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
            <div className="h-20 bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" size="sm">
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="jobs">
            Jobs
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={cn(
                  "border-l-4 transition-all hover:shadow-md",
                  getPriorityColor(notification.priority),
                  !notification.read && "bg-muted/20"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                        <Badge variant="outline" className="text-xs">
                          {notification.priority}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                        
                        <div className="flex items-center gap-2">
                          {!notification.read && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Notification Types</h4>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="job-assignments" className="text-sm">
                  Job Assignments
                </Label>
                <Switch
                  id="job-assignments"
                  checked={settings.jobAssignments}
                  onCheckedChange={(checked) => updateSetting('jobAssignments', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="schedule-changes" className="text-sm">
                  Schedule Changes
                </Label>
                <Switch
                  id="schedule-changes"
                  checked={settings.scheduleChanges}
                  onCheckedChange={(checked) => updateSetting('scheduleChanges', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="payment-updates" className="text-sm">
                  Payment Updates
                </Label>
                <Switch
                  id="payment-updates"
                  checked={settings.paymentUpdates}
                  onCheckedChange={(checked) => updateSetting('paymentUpdates', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="system-updates" className="text-sm">
                  System Updates
                </Label>
                <Switch
                  id="system-updates"
                  checked={settings.systemUpdates}
                  onCheckedChange={(checked) => updateSetting('systemUpdates', checked)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium">Delivery Methods</h4>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notifications" className="text-sm">
                  Email Notifications
                </Label>
                <Switch
                  id="email-notifications"
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="sms-notifications" className="text-sm">
                  SMS Notifications
                </Label>
                <Switch
                  id="sms-notifications"
                  checked={settings.smsNotifications}
                  onCheckedChange={(checked) => updateSetting('smsNotifications', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}