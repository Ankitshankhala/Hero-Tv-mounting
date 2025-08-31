import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle, Calendar, DollarSign, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

interface Notification {
  id: string;
  type: 'booking' | 'payment' | 'system' | 'message';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
}

export const NotificationBell = () => {
  const { metrics } = useAdminMetrics();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Generate notifications based on metrics
  useEffect(() => {
    const newNotifications: Notification[] = [];

    if (metrics.pendingBookings > 0) {
      newNotifications.push({
        id: 'pending-bookings',
        type: 'booking',
        title: 'Pending Bookings',
        message: `${metrics.pendingBookings} booking${metrics.pendingBookings > 1 ? 's' : ''} awaiting confirmation`,
        time: 'now',
        isRead: false,
        priority: metrics.pendingBookings > 5 ? 'high' : 'medium'
      });
    }

    if (metrics.activeWorkers === 0) {
      newNotifications.push({
        id: 'no-workers',
        type: 'system',
        title: 'No Active Workers',
        message: 'No workers are currently available for assignments',
        time: 'now',
        isRead: false,
        priority: 'high'
      });
    }

    setNotifications(newNotifications);
  }, [metrics]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'booking': return <Calendar className="h-4 w-4 text-blue-400" />;
      case 'payment': return <DollarSign className="h-4 w-4 text-green-400" />;
      case 'system': return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'message': return <MessageCircle className="h-4 w-4 text-purple-400" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, isRead: true }))
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="p-3 cursor-pointer"
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start space-x-3 w-full">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${notification.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {notification.title}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {notification.time}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    {!notification.isRead && (
                      <div className="h-2 w-2 bg-blue-500 rounded-full mt-2"></div>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};